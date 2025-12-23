const { useState, useEffect, useMemo } = React;

window.AnalysisView = ({ data }) => {
    const [filterType, setFilterType] = useState('expense'); // expense | income
    const [period, setPeriod] = useState('month'); // month | quarter | year
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);

    useEffect(() => { window.refreshIcons(); }, [filterType, period, currentDate, selectedCategoryId]);

    // Data Processing Logic
    const stats = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const quarter = Math.floor(month / 3);

        const startDate = new Date(year, 
            period === 'month' ? month : (period === 'quarter' ? quarter * 3 : 0), 
            1
        );
        const endDate = new Date(year, 
            period === 'month' ? month + 1 : (period === 'quarter' ? (quarter + 1) * 3 : 12), 
            0
        );

        const categoryGroups = data.settings?.categoryGroups || window.DEFAULT_CATEGORY_GROUPS;
        const flatCategories = window.getFlatCategories(categoryGroups);
        const userAccounts = data.accounts.filter(a => a.userId === data.currentUser || (!a.userId && data.currentUser === 'default')).map(a => a.id);

        let totalAmount = 0;
        const categoryMap = {}; // { mainCategory: { total: 0, subs: { subName: amount } } }
        const trendMap = {}; // { dateLabel: amount }

        data.transactions.forEach(tx => {
            const txDate = new Date(tx.date);
            if (txDate < startDate || txDate > endDate) return;
            if (!userAccounts.includes(tx.accountId)) return;

            let amount = 0;
            let effectiveCatId = tx.categoryId;

            // Strict filtering based on type
            if (filterType === 'expense') {
                if (tx.type === 'expense') {
                    amount = tx.amount;
                    if (tx.splits && tx.splits.length > 0) {
                        const others = tx.splits.reduce((acc, s) => s.owner !== 'me' ? acc + (parseFloat(s.amount)||0) : acc, 0);
                        amount -= others;
                    }
                }
            } else if (filterType === 'income') {
                if (tx.type === 'income') {
                    amount = tx.amount;
                }
            }

            if (amount <= 0) return;

            totalAmount += amount;

            // Category Aggregation
            const catInfo = flatCategories[effectiveCatId] || { group: '未分類', name: '未分類' };
            const mainCat = catInfo.group;
            const subCat = catInfo.name;

            if (!categoryMap[mainCat]) categoryMap[mainCat] = { total: 0, subs: {}, icon: catInfo.icon || 'circle' };
            categoryMap[mainCat].total += amount;
            categoryMap[mainCat].subs[subCat] = (categoryMap[mainCat].subs[subCat] || 0) + amount;

            // Trend Aggregation
            let dateLabel = '';
            if (period === 'month') {
                dateLabel = `${txDate.getDate()}日`;
            } else {
                dateLabel = `${txDate.getMonth() + 1}月`;
            }
            trendMap[dateLabel] = (trendMap[dateLabel] || 0) + amount;
        });

        // Convert Maps to Arrays for Charting
        const categories = Object.entries(categoryMap)
            .map(([name, data]) => ({ name, value: data.total, subs: data.subs, icon: data.icon }))
            .sort((a, b) => b.value - a.value);

        const trendData = [];
        if (period === 'month') {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const label = `${i}日`;
                trendData.push({ label, value: trendMap[label] || 0 });
            }
        } else {
            const startM = period === 'quarter' ? quarter * 3 : 0;
            const endM = period === 'quarter' ? startM + 3 : 12;
            for (let i = startM; i < endM; i++) {
                const label = `${i + 1}月`;
                trendData.push({ label, value: trendMap[label] || 0 });
            }
        }

        return { totalAmount, categories, trendData };
    }, [data, filterType, period, currentDate]);

    // Simple Pie Chart Component (SVG)
    const PieChart = ({ data }) => {
        if (!data || data.length === 0) return <div className="h-48 flex items-center justify-center text-muji-muted text-sm">無資料</div>;
        
        let cumulativePercent = 0;
        
        const getCoordinatesForPercent = (percent) => {
            const x = Math.cos(2 * Math.PI * percent);
            const y = Math.sin(2 * Math.PI * percent);
            return [x, y];
        };

        const slices = data.map((slice, i) => {
            const percent = slice.value / stats.totalAmount;
            const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
            cumulativePercent += percent;
            const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
            const largeArcFlag = percent > 0.5 ? 1 : 0;
            const pathData = `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
            // Generate nice colors (simple loop)
            const hue = (i * 360 / data.length) % 360;
            return <path key={slice.name} d={pathData} fill={`hsl(${hue}, 70%, 60%)`} stroke="white" strokeWidth="0.02" />;
        });

        return (
            <div className="relative w-48 h-48 mx-auto">
                <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                    {slices}
                </svg>
                {/* Center Hole for Donut effect */}
                <div className="absolute inset-0 m-auto w-24 h-24 bg-white rounded-full flex items-center justify-center flex-col">
                    <span className="text-xs text-muji-muted font-bold">總計</span>
                    <span className={`text-sm font-mono font-bold ${filterType==='expense'?'text-rose-500':'text-emerald-500'}`}>${stats.totalAmount.toLocaleString()}</span>
                </div>
            </div>
        );
    };

    // Simple Trend Bar Chart (CSS Flex)
    const TrendChart = ({ data }) => {
        const maxValue = Math.max(...data.map(d => d.value), 1);
        return (
            <div className="flex items-end justify-between h-40 gap-1 pt-6">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        {d.value > 0 && (
                            <div className="absolute -top-6 text-[10px] bg-black text-white px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-mono">
                                ${d.value.toLocaleString()}
                            </div>
                        )}
                        <div 
                            className={`w-full min-w-[4px] rounded-t transition-all ${filterType==='expense'?'bg-rose-300 hover:bg-rose-400':'bg-emerald-300 hover:bg-emerald-400'}`}
                            style={{ height: `${(d.value / maxValue) * 100}%` }}
                        ></div>
                        <span className="text-[10px] text-muji-muted truncate w-full text-center">{d.label.replace('日','').replace('月','')}</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="p-6 animate-fade pb-24">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-muji-text">收支分析</h3>
                <div className="flex bg-muji-bg rounded-lg p-1 border border-muji-border">
                    <button onClick={() => setFilterType('expense')} className={`px-4 py-1.5 rounded text-sm font-bold transition ${filterType === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'text-muji-muted hover:bg-white'}`}>支出</button>
                    <button onClick={() => setFilterType('income')} className={`px-4 py-1.5 rounded text-sm font-bold transition ${filterType === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'text-muji-muted hover:bg-white'}`}>收入</button>
                </div>
            </div>

            {/* Date Filter */}
            <div className="flex justify-center mb-6">
                <div className="flex items-center gap-2 bg-white border border-muji-border rounded-lg p-1 shadow-sm">
                    <button onClick={() => {
                        const newDate = new Date(currentDate);
                        if (period === 'month') newDate.setMonth(newDate.getMonth() - 1);
                        else if (period === 'quarter') newDate.setMonth(newDate.getMonth() - 3);
                        else newDate.setFullYear(newDate.getFullYear() - 1);
                        setCurrentDate(newDate);
                    }} className="p-2 hover:bg-muji-bg rounded"><i data-lucide="chevron-left" className="w-4 h-4"></i></button>
                    
                    <span className="text-sm font-bold w-32 text-center">
                        {period === 'month' && `${currentDate.getFullYear()}年 ${currentDate.getMonth()+1}月`}
                        {period === 'quarter' && `${currentDate.getFullYear()} Q${Math.floor(currentDate.getMonth()/3)+1}`}
                        {period === 'year' && `${currentDate.getFullYear()}年`}
                    </span>

                    <button onClick={() => {
                        const newDate = new Date(currentDate);
                        if (period === 'month') newDate.setMonth(newDate.getMonth() + 1);
                        else if (period === 'quarter') newDate.setMonth(newDate.getMonth() + 3);
                        else newDate.setFullYear(newDate.getFullYear() + 1);
                        setCurrentDate(newDate);
                    }} className="p-2 hover:bg-muji-bg rounded"><i data-lucide="chevron-right" className="w-4 h-4"></i></button>
                    
                    <div className="w-[1px] h-6 bg-muji-border mx-1"></div>
                    
                    <select value={period} onChange={e => setPeriod(e.target.value)} className="bg-transparent text-xs font-bold text-muji-text outline-none cursor-pointer">
                        <option value="month">月</option>
                        <option value="quarter">季</option>
                        <option value="year">年</option>
                    </select>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Left Column: Pie & List */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-muji-border shadow-sm">
                        <h4 className="text-sm font-bold text-muji-text mb-4 text-center">分類佔比</h4>
                        <PieChart data={stats.categories} />
                    </div>
                    
                    <div className="bg-white rounded-xl border border-muji-border shadow-sm overflow-hidden">
                        {stats.categories.map((cat, i) => {
                            const percent = ((cat.value / stats.totalAmount) * 100).toFixed(1);
                            const isExpanded = selectedCategoryId === cat.name;
                            return (
                                <div key={cat.name} className="border-b border-muji-border last:border-0">
                                    <div 
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muji-bg transition-colors"
                                        onClick={() => setSelectedCategoryId(isExpanded ? null : cat.name)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-muji-bg flex items-center justify-center text-muji-text">
                                                <i data-lucide={cat.icon || 'circle'} className="w-4 h-4"></i>
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-muji-text">{cat.name}</div>
                                                <div className="text-xs text-muji-muted">{percent}%</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono font-bold text-muji-text">${cat.value.toLocaleString()}</div>
                                            <i data-lucide={isExpanded ? "chevron-up" : "chevron-down"} className="w-4 h-4 text-muji-muted ml-auto mt-1"></i>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="bg-muji-bg/50 p-4 pt-0 space-y-2">
                                            {Object.entries(cat.subs).sort((a,b)=>b[1]-a[1]).map(([subName, val]) => (
                                                <div key={subName} className="flex justify-between text-xs pl-11">
                                                    <span className="text-muji-text">{subName}</span>
                                                    <span className="font-mono text-muji-muted">${val.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Trend */}
                <div className="bg-white p-6 rounded-xl border border-muji-border shadow-sm flex flex-col h-full min-h-[300px]">
                    <h4 className="text-sm font-bold text-muji-text mb-2">收支走勢</h4>
                    <div className="flex-1 w-full">
                        <TrendChart data={stats.trendData} />
                    </div>
                </div>
            </div>
        </div>
    );
};