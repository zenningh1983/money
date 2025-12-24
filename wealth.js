const { useState, useEffect, useMemo, useCallback, useRef } = React;

// --- 1. 安全的圖示元件 ---
const LucideIcon = React.memo(({ name, className = "", onClick, size = 16 }) => {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current && window.lucide) {
            const i = document.createElement('i');
            i.setAttribute('data-lucide', name);
            if (className) {
                i.className = className;
            } else {
                i.style.width = `${size}px`;
                i.style.height = `${size}px`;
            }
            ref.current.innerHTML = '';
            ref.current.appendChild(i);
            window.lucide.createIcons({
                root: ref.current,
                nameAttr: 'data-lucide'
            });
        }
    }, [name, className, size]);
    return <span ref={ref} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClick}></span>;
});

// --- 2. 核心計算函式 ---
const calculateStockStats = (stock) => {
    const marketValue = stock.quantity * stock.currentPrice;
    const totalCost = stock.quantity * stock.avgCost;
    const unrealizedProfit = marketValue - totalCost;
    const returnRate = totalCost > 0 ? (unrealizedProfit / totalCost) * 100 : 0;
    return { marketValue, totalCost, unrealizedProfit, returnRate };
};

// 新增：根據交易紀錄重算股票狀態 (確保刪除/修改後數據正確)
const recalculateStockState = (symbol, transactions, currentPrice) => {
    let quantity = 0;
    let totalCostBasis = 0;

    // 排序：舊 -> 新
    const sorted = [...transactions]
        .filter(t => t.symbol === symbol && t.type !== 'dividend')
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    sorted.forEach(t => {
        if (t.type === 'buy') {
            totalCostBasis += t.totalAmount;
            quantity += t.quantity;
        } else if (t.type === 'sell') {
            // 賣出時，依比例扣除成本 (採平均成本法概念)
            const avgCost = quantity > 0 ? totalCostBasis / quantity : 0;
            quantity -= t.quantity;
            totalCostBasis -= (avgCost * t.quantity);
        }
    });

    return {
        symbol,
        quantity: Math.max(0, quantity),
        avgCost: quantity > 0 ? totalCostBasis / quantity : 0,
        currentPrice: currentPrice || 0,
        // 保留其他欄位
        name: sorted.length > 0 ? sorted[0].name : symbol
    };
};

// --- 3. 交易/股息編輯 Modal ---
const TradeModal = ({ onClose, onSave, initialData, accounts }) => {
    const [type, setType] = useState(initialData?.type || 'buy');
    const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
    const [symbol, setSymbol] = useState(initialData?.symbol || '');
    const [name, setName] = useState(initialData?.name || '');
    const [price, setPrice] = useState(initialData?.price || '');
    const [quantity, setQuantity] = useState(initialData?.quantity || '');
    const [fee, setFee] = useState(initialData?.fee || '0');
    const [tax, setTax] = useState(initialData?.tax || '0');
    
    // 股息專用
    const [dividendAmount, setDividendAmount] = useState(initialData?.amount || '');
    const [targetAccountId, setTargetAccountId] = useState(initialData?.accountId || (accounts.length > 0 ? accounts[0].id : ''));

    // 自動計算
    const totalTradeAmount = useMemo(() => {
        const p = parseFloat(price) || 0;
        const q = parseInt(quantity) || 0;
        const f = parseInt(fee) || 0;
        const t = parseInt(tax) || 0;
        if (type === 'buy') return (p * q) + f;
        if (type === 'sell') return (p * q) - f - t;
        return 0;
    }, [price, quantity, fee, tax, type]);

    const handleSave = () => {
        if (!symbol) return alert('請輸入股票代號');
        
        const baseData = {
            id: initialData?.id || Date.now().toString(),
            date,
            symbol: symbol.toUpperCase(),
            name,
            type
        };

        if (type === 'dividend') {
            if (!dividendAmount) return alert('請輸入金額');
            onSave({
                ...baseData,
                amount: parseFloat(dividendAmount),
                accountId: targetAccountId
            });
        } else {
            if (!price || !quantity) return alert('請輸入價格與股數');
            onSave({
                ...baseData,
                price: parseFloat(price),
                quantity: parseInt(quantity),
                fee: parseInt(fee) || 0,
                tax: parseInt(tax) || 0,
                totalAmount: totalTradeAmount
            });
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-muji-border overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-muji-border flex justify-between items-center bg-muji-bg">
                    <h3 className="font-bold text-lg text-muji-text">{initialData ? '編輯紀錄' : '新增紀錄'}</h3>
                    <button onClick={onClose}><LucideIcon name="x" className="w-5 h-5 text-muji-muted" /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    {/* 類型切換 */}
                    <div className="flex bg-muji-bg rounded-lg p-1">
                        <button onClick={() => setType('buy')} className={`flex-1 py-2 rounded text-sm font-bold transition ${type === 'buy' ? 'bg-muji-red text-white shadow-sm' : 'text-muji-muted'}`}>買入</button>
                        <button onClick={() => setType('sell')} className={`flex-1 py-2 rounded text-sm font-bold transition ${type === 'sell' ? 'bg-muji-green text-white shadow-sm' : 'text-muji-muted'}`}>賣出</button>
                        <button onClick={() => setType('dividend')} className={`flex-1 py-2 rounded text-sm font-bold transition ${type === 'dividend' ? 'bg-yellow-500 text-white shadow-sm' : 'text-muji-muted'}`}>股息</button>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                            <label className="text-xs text-muji-muted">日期</label>
                            <input type="date" className="w-full p-2 border border-muji-border rounded" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="flex-1 space-y-1">
                            <label className="text-xs text-muji-muted">代號</label>
                            <input type="text" className="w-full p-2 border border-muji-border rounded uppercase font-mono" placeholder="2330" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} />
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-xs text-muji-muted">名稱</label>
                        <input type="text" className="w-full p-2 border border-muji-border rounded" placeholder="台積電" value={name} onChange={e => setName(e.target.value)} />
                    </div>

                    {type === 'dividend' ? (
                        <>
                            <div className="space-y-1">
                                <label className="text-xs text-muji-muted">股息金額</label>
                                <input type="number" className="w-full p-2 border border-muji-border rounded font-mono text-lg font-bold" placeholder="0" value={dividendAmount} onChange={e => setDividendAmount(e.target.value)} />
                            </div>
                            {accounts.length > 0 && (
                                <div className="space-y-1">
                                    <label className="text-xs text-muji-muted">存入帳戶</label>
                                    <select className="w-full p-2 border border-muji-border rounded bg-white" value={targetAccountId} onChange={e => setTargetAccountId(e.target.value)}>
                                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="flex gap-2">
                                <div className="flex-1 space-y-1">
                                    <label className="text-xs text-muji-muted">成交價</label>
                                    <input type="number" step="0.01" className="w-full p-2 border border-muji-border rounded font-mono" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <label className="text-xs text-muji-muted">股數</label>
                                    <input type="number" className="w-full p-2 border border-muji-border rounded font-mono" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1 space-y-1">
                                    <label className="text-xs text-muji-muted">手續費</label>
                                    <input type="number" className="w-full p-2 border border-muji-border rounded font-mono" placeholder="0" value={fee} onChange={e => setFee(e.target.value)} />
                                </div>
                                {type === 'sell' && (
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs text-muji-muted">交易稅</label>
                                        <input type="number" className="w-full p-2 border border-muji-border rounded font-mono" placeholder="0" value={tax} onChange={e => setTax(e.target.value)} />
                                    </div>
                                )}
                            </div>
                            <div className="pt-4 border-t border-muji-border">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-muji-muted">{type === 'buy' ? '總成本' : '實拿金額'}</span>
                                    <span className={`text-xl font-bold font-mono ${type === 'buy' ? 'text-muji-red' : 'text-muji-green'}`}>
                                        ${Math.round(totalTradeAmount).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}

                    <button onClick={handleSave} className="w-full py-3 bg-muji-accent text-white rounded-lg font-bold shadow-sm mt-2">儲存</button>
                </div>
            </div>
        </div>
    );
};

// --- 4. 股票明細視圖 ---
const StockDetailView = ({ stock, transactions, dividends, onBack, onAddRecord, onUpdatePrice, onEditRecord, onDeleteRecord }) => {
    const [tab, setTab] = useState('trade');
    const [priceInput, setPriceInput] = useState(stock.currentPrice);
    const stats = calculateStockStats({ ...stock, currentPrice: priceInput });

    // 當外部 stock 更新時，同步更新 input
    useEffect(() => {
        setPriceInput(stock.currentPrice);
    }, [stock.currentPrice]);

    const handlePriceBlur = () => {
        if (priceInput !== stock.currentPrice) {
            onUpdatePrice(stock.symbol, parseFloat(priceInput));
        }
    };

    return (
        <div className="h-full flex flex-col bg-white animate-fade relative">
            {/* Header */}
            <div className="p-4 border-b border-muji-border bg-white flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 -ml-2 hover:bg-muji-bg rounded-full">
                        <LucideIcon name="arrow-left" className="w-6 h-6 text-muji-text" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="bg-muji-accent text-white text-xs px-2 py-0.5 rounded font-mono">{stock.symbol}</span>
                            <h3 className="font-bold text-lg text-muji-text">{stock.name}</h3>
                        </div>
                    </div>
                </div>
                <button onClick={() => onAddRecord({ symbol: stock.symbol, name: stock.name })} className="bg-muji-accent text-white px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-opacity-90 flex items-center gap-2 text-xs">
                    <LucideIcon name="plus" className="w-4 h-4" /> 新增
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                {/* 1. 總覽卡片 (含現價輸入) */}
                <div className="p-5 m-4 bg-muji-bg/50 rounded-xl border border-muji-border">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="text-center">
                            <div className="text-xs text-muji-muted mb-1">持有股數</div>
                            <div className="font-bold font-mono text-xl text-muji-text">{stock.quantity.toLocaleString()}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-muji-muted mb-1">目前股價 (點擊修改)</div>
                            <div className="flex items-center justify-center gap-1">
                                <span className="font-mono text-xl text-muji-text">$</span>
                                <input 
                                    type="number" 
                                    value={priceInput}
                                    onChange={(e) => setPriceInput(e.target.value)}
                                    onBlur={handlePriceBlur}
                                    onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                    className="font-bold font-mono text-xl text-muji-text bg-transparent border-b border-dashed border-muji-muted w-24 text-center focus:outline-none focus:border-muji-accent"
                                />
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-muji-muted mb-1">股票現值 (市值)</div>
                            <div className="font-bold font-mono text-xl text-muji-text">
                                ${Math.round(stats.marketValue).toLocaleString()}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-muji-muted mb-1">投資損益</div>
                            <div className={`font-bold font-mono text-xl ${stats.unrealizedProfit >= 0 ? 'text-muji-red' : 'text-muji-green'}`}>
                                {stats.unrealizedProfit > 0 ? '+' : ''}{Math.round(stats.unrealizedProfit).toLocaleString()}
                                <div className="text-xs opacity-70">({stats.returnRate.toFixed(1)}%)</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-muji-border mx-4">
                    <button onClick={() => setTab('trade')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 ${tab === 'trade' ? 'border-muji-accent text-muji-text' : 'border-transparent text-muji-muted'}`}>
                        <LucideIcon name="arrow-right-left" className="w-4 h-4" /> 買賣明細
                    </button>
                    <button onClick={() => setTab('dividend')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 ${tab === 'dividend' ? 'border-muji-accent text-muji-text' : 'border-transparent text-muji-muted'}`}>
                        <LucideIcon name="coins" className="w-4 h-4" /> 股息紀錄
                    </button>
                </div>

                {/* Content List */}
                <div className="p-4 space-y-3">
                    {tab === 'trade' ? (
                        transactions.length === 0 ? 
                            <div className="text-center text-muji-muted py-10">無交易紀錄</div> :
                            transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map(tx => (
                                <div key={tx.id} className="bg-white p-4 rounded-xl border border-muji-border flex justify-between items-center shadow-sm group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs ${tx.type === 'buy' ? 'bg-muji-red' : 'bg-muji-green'}`}>
                                            {tx.type === 'buy' ? '買' : '賣'}
                                        </div>
                                        <div>
                                            <div className="font-mono text-sm font-bold text-muji-text">{tx.date}</div>
                                            <div className="text-xs text-muji-muted">{tx.quantity}股 @ ${tx.price}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="font-mono font-bold text-muji-text">${(tx.totalAmount || 0).toLocaleString()}</div>
                                            <div className="text-[10px] text-muji-muted">
                                                手續費: {tx.fee}
                                            </div>
                                        </div>
                                        {/* 編輯與刪除按鈕 */}
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onEditRecord(tx)} className="p-1.5 text-muji-muted hover:text-muji-accent hover:bg-muji-bg rounded">
                                                <LucideIcon name="pencil" className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => onDeleteRecord(tx.id)} className="p-1.5 text-muji-muted hover:text-red-500 hover:bg-red-50 rounded">
                                                <LucideIcon name="trash-2" className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                    ) : (
                        // Dividend List (Optional: Add edit/delete here too if needed, simplified for now)
                        dividends.length === 0 ? 
                            <div className="text-center text-muji-muted py-10">無股息紀錄</div> :
                            dividends.sort((a,b) => new Date(b.date) - new Date(a.date)).map(div => (
                                <div key={div.id} className="bg-white p-4 rounded-xl border border-muji-border flex justify-between items-center shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                                            <LucideIcon name="gift" className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-mono text-sm font-bold text-muji-text">{div.date}</div>
                                            <div className="text-xs text-muji-muted">{div.note}</div>
                                        </div>
                                    </div>
                                    <div className="font-mono font-bold text-emerald-600">+${div.amount.toLocaleString()}</div>
                                </div>
                            ))
                    )}
                </div>
            </div>
        </div>
    );
};

// --- 5. 主視圖 ---
window.WealthView = ({ data, saveData, showToast }) => {
    const [showTradeModal, setShowTradeModal] = useState(false);
    const [activeStock, setActiveStock] = useState(null); 
    const [tradeInitialData, setTradeInitialData] = useState(null); 

    const userAccounts = data.accounts.filter(a => a.userId === data.currentUser || (!a.userId && data.currentUser === 'default'));
    const stocks = data.stocks.filter(s => s.userId === data.currentUser || (!s.userId && data.currentUser === 'default'));
    const stockTransactions = data.stockTransactions || [];
    const mainTransactions = data.transactions || [];

    // Helper: Find dividends for a stock
    const getStockDividends = (stock) => {
        return mainTransactions.filter(tx => 
            tx.type === 'income' && 
            tx.categoryId.includes('股息') && 
            (tx.note.includes(stock.symbol) || tx.note.includes(stock.name))
        );
    };

    // 核心邏輯：處理交易紀錄的 新增/修改/刪除
    const updateStockFromHistory = (symbol, newTransactions) => {
        // 1. 找出目前的股價 (若無則使用舊的)
        const oldStock = stocks.find(s => s.symbol === symbol);
        const currentPrice = oldStock ? oldStock.currentPrice : 0;

        // 2. 重新計算該股票的狀態 (股數、成本)
        const calculatedStock = recalculateStockState(symbol, newTransactions, currentPrice);
        calculatedStock.userId = data.currentUser;
        
        // 3. 更新 stocks 陣列
        const otherStocks = data.stocks.filter(s => s.symbol !== symbol || (s.userId !== data.currentUser && data.currentUser !== 'default'));
        
        // 如果股數 > 0，加入列表；否則移除
        let newStockList = otherStocks;
        if (calculatedStock.quantity > 0) {
            newStockList = [...otherStocks, calculatedStock];
        }

        return newStockList;
    };

    const handleSaveRecord = (record) => {
        if (record.type === 'dividend') {
            // 股息邏輯維持不變
            const newTx = {
                id: record.id || Date.now().toString(),
                date: record.date,
                type: 'income',
                amount: record.amount,
                categoryId: 'passive_股息',
                accountId: record.accountId,
                note: `股息 ${record.symbol} ${record.name}`,
                userId: data.currentUser
            };
            // 檢查是新增還是編輯
            const isEdit = data.transactions.some(t => t.id === newTx.id);
            let newMainTransactions = isEdit 
                ? data.transactions.map(t => t.id === newTx.id ? newTx : t)
                : [...data.transactions, newTx];

            saveData({ ...data, transactions: newMainTransactions });
            showToast('股息紀錄已更新');
        } else {
            // 股票交易 (買/賣)
            // 1. 更新 Transaction List
            let newStockTransactions = [...stockTransactions];
            const existingIndex = newStockTransactions.findIndex(t => t.id === record.id);
            
            if (existingIndex >= 0) {
                newStockTransactions[existingIndex] = record; // 更新
            } else {
                newStockTransactions.push(record); // 新增
            }

            // 2. 根據全歷史重算 Stock State
            const newStocks = updateStockFromHistory(record.symbol, newStockTransactions);

            // 3. 儲存
            saveData({ ...data, stocks: newStocks, stockTransactions: newStockTransactions });
            showToast(`交易已儲存：${record.symbol}`);
            
            // 若目前正在檢視該股票，需確保 activeStock 狀態同步更新
            const updatedStock = newStocks.find(s => s.symbol === record.symbol);
            if (activeStock && activeStock.symbol === record.symbol) {
                setActiveStock(updatedStock || null);
            }
        }
        setShowTradeModal(false);
        setTradeInitialData(null);
    };

    const handleDeleteRecord = (id) => {
        if (!confirm('確定要刪除這筆交易嗎？刪除後會自動重新計算平均成本與庫存。')) return;

        // 1. 找出該交易以得知 symbol
        const tx = stockTransactions.find(t => t.id === id);
        if (!tx) return;

        // 2. 移除交易
        const newStockTransactions = stockTransactions.filter(t => t.id !== id);

        // 3. 重算 Stock State
        const newStocks = updateStockFromHistory(tx.symbol, newStockTransactions);

        // 4. 儲存
        saveData({ ...data, stocks: newStocks, stockTransactions: newStockTransactions });
        showToast('交易已刪除，庫存已重算');

        // 同步 activeStock
        const updatedStock = newStocks.find(s => s.symbol === tx.symbol);
        setActiveStock(updatedStock || null); // 若刪光了可能會變成 null，自動退回列表
    };

    const handleUpdatePrice = (symbol, newPrice) => {
        const newStocks = stocks.map(s => s.symbol === symbol ? { ...s, currentPrice: newPrice } : s);
        saveData({ ...data, stocks: newStocks });
        
        // 同步 activeStock
        if (activeStock && activeStock.symbol === symbol) {
            setActiveStock({ ...activeStock, currentPrice: newPrice });
        }
    };

    // 計算總資產
    const summary = useMemo(() => {
        let totalVal = 0;
        let totalCost = 0;
        stocks.forEach(s => {
            totalVal += s.quantity * s.currentPrice;
            totalCost += s.quantity * s.avgCost;
        });
        const profit = totalVal - totalCost;
        const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
        return { totalVal, profit, roi };
    }, [stocks]);

    if (activeStock) {
        return (
            <>
                <StockDetailView 
                    stock={activeStock}
                    transactions={stockTransactions.filter(t => t.symbol === activeStock.symbol)}
                    dividends={getStockDividends(activeStock)}
                    onBack={() => setActiveStock(null)}
                    onAddRecord={(prefillData) => {
                        setTradeInitialData(prefillData);
                        setShowTradeModal(true);
                    }}
                    onUpdatePrice={handleUpdatePrice}
                    onEditRecord={(tx) => {
                        setTradeInitialData(tx);
                        setShowTradeModal(true);
                    }}
                    onDeleteRecord={handleDeleteRecord}
                />
                {showTradeModal && <TradeModal onClose={() => setShowTradeModal(false)} onSave={handleSaveRecord} accounts={userAccounts} initialData={tradeInitialData} />}
            </>
        );
    }

    return (
        <div className="p-6 md:p-10 animate-fade space-y-8 pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-2xl font-bold text-muji-text">股票庫存</h3>
                    <p className="text-sm text-muji-muted mt-1">長期持有，複利滾存</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <div className="bg-white px-4 py-2 rounded-lg border border-muji-border flex-shrink-0">
                        <div className="text-xs text-muji-muted">總市值 (Total Assets)</div>
                        <div className="text-lg font-bold font-mono text-muji-text">${Math.round(summary.totalVal).toLocaleString()}</div>
                    </div>
                    <div className={`px-4 py-2 rounded-lg border flex-shrink-0 ${summary.profit >= 0 ? 'bg-muji-red/10 border-muji-red/20 text-muji-red' : 'bg-muji-green/10 border-muji-green/20 text-muji-green'}`}>
                        <div className="text-xs opacity-70">總損益</div>
                        <div className="text-lg font-bold font-mono">
                            {summary.profit >= 0 ? '+' : ''}{Math.round(summary.profit).toLocaleString()} 
                            <span className="text-xs ml-1">({summary.roi.toFixed(1)}%)</span>
                        </div>
                    </div>
                    <button onClick={() => { setTradeInitialData(null); setShowTradeModal(true); }} className="bg-muji-accent text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-opacity-90 flex items-center gap-2 flex-shrink-0">
                        <LucideIcon name="plus" className="w-4 h-4" /> 記帳
                    </button>
                </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-muji-border bg-white shadow-sm">
                <table className="w-full text-left text-sm text-muji-text">
                    <thead className="bg-muji-bg text-muji-muted font-medium border-b border-muji-border">
                        <tr>
                            <th className="p-4">代號 / 名稱</th>
                            <th className="p-4 text-right">持有股數</th>
                            <th className="p-4 text-right">平均成本</th>
                            <th className="p-4 text-right">現價</th>
                            <th className="p-4 text-right">市值 (總資產)</th>
                            <th className="p-4 text-right">未實現損益</th>
                            <th className="p-4 text-center">明細</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-muji-border">
                        {stocks.map(s => {
                            const stats = calculateStockStats(s);
                            return (
                                <tr key={s.symbol} className="hover:bg-muji-hover transition-colors cursor-pointer" onClick={() => setActiveStock(s)}>
                                    <td className="p-4">
                                        <div className="font-bold font-mono text-base">{s.symbol}</div>
                                        <div className="text-xs text-muji-muted">{s.name}</div>
                                    </td>
                                    <td className="p-4 text-right font-mono">{s.quantity.toLocaleString()}</td>
                                    <td className="p-4 text-right font-mono text-muji-muted">${s.avgCost.toFixed(2)}</td>
                                    <td className="p-4 text-right font-mono font-bold">${s.currentPrice}</td>
                                    <td className="p-4 text-right font-mono font-bold text-muji-text">${Math.round(stats.marketValue).toLocaleString()}</td>
                                    <td className={`p-4 text-right font-mono font-bold ${stats.unrealizedProfit >= 0 ? 'text-muji-red' : 'text-muji-green'}`}>
                                        {stats.unrealizedProfit >= 0 ? '+' : ''}{Math.round(stats.unrealizedProfit).toLocaleString()}
                                        <br/>
                                        <span className="text-[10px] opacity-70">{stats.returnRate.toFixed(1)}%</span>
                                    </td>
                                    <td className="p-4 text-center text-muji-muted">
                                        <LucideIcon name="chevron-right" className="w-4 h-4 mx-auto" />
                                    </td>
                                </tr>
                            );
                        })}
                        {stocks.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-muji-muted">尚無庫存</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden grid gap-4">
                {stocks.map(s => {
                    const stats = calculateStockStats(s);
                    return (
                        <div key={s.symbol} onClick={() => setActiveStock(s)} className="bg-white p-4 rounded-xl border border-muji-border shadow-sm active:scale-95 transition-transform cursor-pointer">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="bg-muji-bg text-muji-text font-bold px-2 py-1 rounded font-mono text-sm">{s.symbol}</span>
                                    <span className="font-bold text-muji-text">{s.name}</span>
                                </div>
                                <div className={`text-right font-mono font-bold ${stats.unrealizedProfit >= 0 ? 'text-muji-red' : 'text-muji-green'}`}>
                                    {stats.unrealizedProfit >= 0 ? '+' : ''}{Math.round(stats.unrealizedProfit).toLocaleString()}
                                    <div className="text-xs opacity-70">{stats.returnRate.toFixed(1)}%</div>
                                </div>
                            </div>
                            <div className="flex justify-between items-end text-sm mt-4">
                                <div>
                                    <div className="text-muji-muted text-xs">市值 ${Math.round(stats.marketValue).toLocaleString()}</div>
                                    <div className="text-muji-muted text-xs">均價 ${s.avgCost.toFixed(1)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-muji-muted text-xs mb-0.5">現價 ${s.currentPrice}</div>
                                    <div className="font-mono font-bold text-lg text-muji-text">{s.quantity.toLocaleString()}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {stocks.length === 0 && <div className="text-center text-muji-muted py-10 bg-muji-card rounded-xl border border-dashed border-muji-border">尚無庫存</div>}
            </div>

            {showTradeModal && <TradeModal onClose={() => setShowTradeModal(false)} onSave={handleSaveRecord} accounts={userAccounts} initialData={tradeInitialData} />}
        </div>
    );
};