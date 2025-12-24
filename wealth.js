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
const calculateStockFinancials = (stock, transactions = []) => {
    // 1. 庫存狀態 (未實現)
    const marketValue = stock.quantity * stock.currentPrice;
    const totalCost = stock.quantity * stock.avgCost;
    const unrealizedProfit = marketValue - totalCost;
    const returnRate = totalCost > 0 ? (unrealizedProfit / totalCost) * 100 : 0;

    // 2. 歷史損益 (已實現) - 僅計算資本利得(價差)，不含股息
    let realizedProfit = 0;
    let tempQty = 0;
    let tempCost = 0;

    // 依時間排序計算
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTxs.forEach(tx => {
        if (tx.type === 'buy') {
            tempCost += tx.totalAmount;
            tempQty += tx.quantity;
        } else if (tx.type === 'sell') {
            if (tempQty > 0) {
                // 賣出時，依照當時的平均成本計算成本
                const avg = tempCost / tempQty;
                const costOfSold = avg * tx.quantity;
                
                // 賣出淨收入 (totalAmount 已扣除手續費和稅) - 成本
                const profit = tx.totalAmount - costOfSold;
                realizedProfit += profit;

                // 更新剩餘庫存成本
                tempCost -= costOfSold;
                tempQty -= tx.quantity;
            }
        }
    });

    return { marketValue, totalCost, unrealizedProfit, returnRate, realizedProfit };
};

// 根據交易紀錄重算股票狀態 (庫存 snapshot)
// 新增 originalName 參數，若無交易紀錄時優先使用原名稱，避免被重置為代號
const recalculateStockState = (symbol, transactions, currentPrice, originalName = '') => {
    let quantity = 0;
    let totalCostBasis = 0;

    const sorted = [...transactions]
        .filter(t => t.symbol === symbol && t.type !== 'dividend')
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    sorted.forEach(t => {
        if (t.type === 'buy') {
            totalCostBasis += t.totalAmount;
            quantity += t.quantity;
        } else if (t.type === 'sell') {
            const avgCost = quantity > 0 ? totalCostBasis / quantity : 0;
            quantity -= t.quantity;
            totalCostBasis -= (avgCost * t.quantity);
        }
    });

    // 名稱優先順序：最新交易的名稱 > 原本設定的名稱 > 代號
    const name = sorted.length > 0 ? sorted[sorted.length - 1].name : (originalName || symbol);

    return {
        symbol,
        quantity: Math.max(0, quantity),
        avgCost: quantity > 0 ? totalCostBasis / quantity : 0,
        currentPrice: currentPrice || 0,
        name
    };
};

// 簡單數學運算解析
const calculateExpression = (expression) => {
    try {
        const safeExpr = expression.replace(/[^0-9+\-*/.() ]/g, '');
        if (!safeExpr) return expression;
        // eslint-disable-next-line no-new-func
        return new Function('return ' + safeExpr)();
    } catch (e) {
        return expression;
    }
};

// 日期標準化函式
const normalizeDate = (dateStr) => {
    if (!dateStr) return '';
    const cleanStr = dateStr.replace(/\//g, '-');
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
        const y = parts[0];
        const m = parts[1].padStart(2, '0');
        const d = parts[2].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return cleanStr;
};

// --- 3. 批次匯入 Modal ---
const BatchImportModal = ({ onClose, onImport, defaultSymbol, defaultName }) => {
    const [step, setStep] = useState('input'); // input | preview
    const [text, setText] = useState('');
    const [previewData, setPreviewData] = useState([]);

    const handleParse = () => {
        const lines = text.split('\n').filter(l => l.trim());
        const parsed = [];
        
        lines.forEach(line => {
            try {
                const cleanLine = line.replace(/,/g, '');
                const parts = cleanLine.trim().split(/\s+/);
                
                if (defaultSymbol && parts.length >= 4) {
                    const action = parts[0]; 
                    const date = normalizeDate(parts[1]);
                    const price = parseFloat(parts[2]);
                    const quantity = parseFloat(parts[3]);
                    const fee = parts[4] ? parseFloat(parts[4]) : 0;
                    const tax = parts[5] ? parseFloat(parts[5]) : 0;
                    
                    let type = 'buy';
                    if (action.includes('賣')) type = 'sell';
                    else if (action.includes('息')) type = 'dividend';

                    if (type === 'dividend') {
                         const amount = parseFloat(parts[2]);
                         if (amount > 0) {
                             parsed.push({ date, type, symbol: defaultSymbol, name: defaultName, amount, fee: 0, tax: 0 });
                         }
                    } else if (price > 0 && quantity > 0) {
                        let totalAmount = 0;
                        if (type === 'buy') totalAmount = (price * quantity) + fee;
                        else totalAmount = (price * quantity) - fee - tax;
                        
                        parsed.push({ date, type, symbol: defaultSymbol, name: defaultName, price, quantity, fee, tax, totalAmount });
                    }
                    return;
                }

                if (parts.length >= 3 && !defaultSymbol) {
                    let date = normalizeDate(parts[0]);
                    let typeStr = parts[1];
                    let symbol = parts[2].toUpperCase();
                    let name = symbol; 
                    let price = 0, quantity = 0, fee = 0, tax = 0, amount = 0;

                    let type = 'buy';
                    if (typeStr.includes('賣')) type = 'sell';
                    else if (typeStr.includes('息')) type = 'dividend';

                    let numStartIndex = 3;
                    if (parts.length > 3 && isNaN(parseFloat(parts[3]))) {
                        name = parts[3];
                        numStartIndex = 4;
                    }

                    if (type === 'dividend') {
                        amount = parseFloat(parts[numStartIndex]) || 0;
                    } else {
                        price = parseFloat(parts[numStartIndex]) || 0;
                        quantity = parseFloat(parts[numStartIndex + 1]) || 0;
                        fee = parseFloat(parts[numStartIndex + 2]) || 0;
                        tax = parseFloat(parts[numStartIndex + 3]) || 0;
                    }

                    if (type === 'dividend' && amount > 0) {
                        parsed.push({ date, type, symbol, name, amount, fee: 0, tax: 0 });
                    } else if ((type === 'buy' || type === 'sell') && price > 0 && quantity > 0) {
                        let totalAmount = 0;
                        if (type === 'buy') totalAmount = (price * quantity) + fee;
                        else totalAmount = (price * quantity) - fee - tax;
                        parsed.push({ date, type, symbol, name, price, quantity, fee, tax, totalAmount });
                    }
                }
            } catch (e) {
                console.error("Parse line error:", line, e);
            }
        });

        if (parsed.length > 0) {
            setPreviewData(parsed);
            setStep('preview');
        } else {
            alert('無法解析資料，請檢查格式');
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-muji-border overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-muji-border flex justify-between items-center bg-muji-bg">
                    <h3 className="font-bold text-lg text-muji-text">{defaultSymbol ? `匯入交易 (${defaultSymbol})` : '批次匯入交易'}</h3>
                    <button onClick={onClose}><LucideIcon name="x" className="w-5 h-5 text-muji-muted" /></button>
                </div>
                
                {step === 'input' ? (
                    <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                        <div className="text-xs text-muji-muted bg-muji-bg p-3 rounded border border-muji-border">
                            <p className="font-bold mb-1">格式範例 (空格分隔)：</p>
                            {defaultSymbol ? (
                                <>
                                    <p>買 2024/1/2 15.98 5,000 74</p>
                                    <p>賣 2024/2/15 18.5 2,000 30 10</p>
                                    <p className="mt-1 text-muji-accent">格式: 動作 日期 價格 股數 [手續費] [稅]</p>
                                </>
                            ) : (
                                <>
                                    <p>2023-10-27 買入 2330 台積電 533 1000 20</p>
                                    <p>2023/11/01 賣出 00878 國泰永續 20.5 500 10 3</p>
                                </>
                            )}
                        </div>
                        <textarea 
                            className="w-full h-60 p-3 border border-muji-border rounded-lg text-sm font-mono focus:border-muji-accent outline-none"
                            placeholder="請貼上交易資料..."
                            value={text}
                            onChange={e => setText(e.target.value)}
                        ></textarea>
                        <button onClick={handleParse} className="w-full py-3 bg-muji-accent text-white rounded-lg font-bold shadow-sm">解析並預覽</button>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        <div className="p-4 bg-yellow-50 text-yellow-800 text-sm border-b border-yellow-100 flex justify-between items-center">
                            <span>請確認以下資料是否正確 ({previewData.length} 筆)</span>
                            <button onClick={() => setStep('input')} className="text-xs underline">返回修改</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-0">
                            <table className="w-full text-left text-xs md:text-sm">
                                <thead className="bg-muji-bg text-muji-muted font-medium sticky top-0 shadow-sm">
                                    <tr>
                                        <th className="p-3">日期</th>
                                        <th className="p-3">類型</th>
                                        {!defaultSymbol && <th className="p-3">代號</th>}
                                        <th className="p-3 text-right">單價</th>
                                        <th className="p-3 text-right">股數</th>
                                        <th className="p-3 text-right">手續費</th>
                                        <th className="p-3 text-right">總金額</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-muji-border">
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-muji-hover">
                                            <td className="p-3 font-mono">{row.date}</td>
                                            <td className={`p-3 font-bold ${row.type === 'buy' ? 'text-muji-red' : row.type === 'sell' ? 'text-muji-green' : 'text-yellow-600'}`}>
                                                {row.type === 'buy' ? '買入' : row.type === 'sell' ? '賣出' : '股息'}
                                            </td>
                                            {!defaultSymbol && <td className="p-3 font-mono">{row.symbol}</td>}
                                            <td className="p-3 text-right font-mono">{row.price || '-'}</td>
                                            <td className="p-3 text-right font-mono">{row.quantity || '-'}</td>
                                            <td className="p-3 text-right font-mono">{row.fee}</td>
                                            <td className="p-3 text-right font-mono font-bold">{row.amount ? `+${row.amount}` : row.totalAmount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-muji-border bg-white flex gap-3">
                            <button onClick={() => setStep('input')} className="flex-1 py-3 border border-muji-border rounded-lg font-bold text-muji-text">返回</button>
                            <button onClick={() => onImport(previewData)} className="flex-[2] py-3 bg-muji-accent text-white rounded-lg font-bold shadow-sm">確認匯入</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- 4. 交易/股息編輯 Modal ---
const TradeModal = ({ onClose, onSave, initialData, accounts }) => {
    const [type, setType] = useState(initialData?.type || 'buy');
    const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
    // 隱藏的資料，用於儲存
    const [symbol] = useState(initialData?.symbol || '');
    const [name] = useState(initialData?.name || '');
    const [assetType] = useState(initialData?.assetType || '個股');

    const [price, setPrice] = useState(initialData?.price || '');
    const [quantity, setQuantity] = useState(initialData?.quantity || '');
    const [fee, setFee] = useState(initialData?.fee || '0');
    const [tax, setTax] = useState(initialData?.tax || '0');
    const [dividendAmount, setDividendAmount] = useState(initialData?.amount || '');
    const [targetAccountId, setTargetAccountId] = useState(initialData?.accountId || (accounts.length > 0 ? accounts[0].id : ''));

    const totalTradeAmount = useMemo(() => {
        const p = parseFloat(price) || 0;
        const q = parseInt(quantity) || 0;
        const f = parseFloat(fee) || 0;
        const t = parseFloat(tax) || 0;
        if (type === 'buy') return (p * q) + f;
        if (type === 'sell') return (p * q) - f - t;
        return 0;
    }, [price, quantity, fee, tax, type]);

    const handleSave = () => {
        if (!symbol) return alert('系統錯誤：找不到股票代號');
        const baseData = { id: initialData?.id || Date.now().toString(), date, symbol: symbol.toUpperCase(), name, type, assetType };
        if (type === 'dividend') {
            if (!dividendAmount) return alert('請輸入金額');
            onSave({ ...baseData, amount: parseFloat(dividendAmount), accountId: targetAccountId });
        } else {
            if (!price || !quantity) return alert('請輸入價格與股數');
            onSave({ ...baseData, price: parseFloat(price), quantity: parseInt(quantity), fee: parseFloat(fee) || 0, tax: parseFloat(tax) || 0, totalAmount: totalTradeAmount });
        }
    };

    const handleFeeKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const res = calculateExpression(fee.toString());
            setFee(res.toString());
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-muji-border overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-muji-border flex justify-between items-center bg-muji-bg">
                    <h3 className="font-bold text-lg text-muji-text">{initialData?.id ? '編輯紀錄' : '新增紀錄'} ({symbol})</h3>
                    <button onClick={onClose}><LucideIcon name="x" className="w-5 h-5 text-muji-muted" /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="flex bg-muji-bg rounded-lg p-1">
                        <button onClick={() => setType('buy')} className={`flex-1 py-2 rounded text-sm font-bold transition ${type === 'buy' ? 'bg-muji-red text-white shadow-sm' : 'text-muji-muted'}`}>買入</button>
                        <button onClick={() => setType('sell')} className={`flex-1 py-2 rounded text-sm font-bold transition ${type === 'sell' ? 'bg-muji-green text-white shadow-sm' : 'text-muji-muted'}`}>賣出</button>
                        <button onClick={() => setType('dividend')} className={`flex-1 py-2 rounded text-sm font-bold transition ${type === 'dividend' ? 'bg-yellow-500 text-white shadow-sm' : 'text-muji-muted'}`}>股息</button>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs text-muji-muted">交易日期</label>
                        <input type="date" className="w-full p-2 border border-muji-border rounded bg-white" value={date} onChange={e => setDate(e.target.value)} />
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
                                    <label className="text-xs text-muji-muted">手續費 (可輸入算式)</label>
                                    <input type="text" className="w-full p-2 border border-muji-border rounded font-mono" placeholder="0" value={fee} onChange={e => setFee(e.target.value)} onKeyDown={handleFeeKeyDown} />
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
                                    <span className={`text-xl font-bold font-mono ${type === 'buy' ? 'text-muji-red' : 'text-muji-green'}`}>${Math.round(totalTradeAmount).toLocaleString()}</span>
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

// --- 5. 股票編輯/新增 Modal (共用) ---
const StockEditModal = ({ stock, onClose, onSave }) => {
    // 判斷是否為新增模式 (根據是否有 symbol)
    const isNew = !stock.symbol;
    const [symbol, setSymbol] = useState(stock.symbol || '');
    const [name, setName] = useState(stock.name || '');
    const [currentPrice, setCurrentPrice] = useState(stock.currentPrice || '');
    const [assetType, setAssetType] = useState(stock.assetType || '個股');
    const [dividendFrequency, setDividendFrequency] = useState(stock.dividendFrequency || '');

    const handleSave = () => {
        if (isNew && !symbol) {
            alert('請輸入代號');
            return;
        }
        onSave({ 
            ...stock, 
            symbol: isNew ? symbol.toUpperCase() : stock.symbol,
            name, 
            currentPrice: parseFloat(currentPrice) || 0, 
            assetType, 
            dividendFrequency 
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop">
            <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl border border-muji-border overflow-hidden flex flex-col">
                <div className="p-4 border-b border-muji-border flex justify-between items-center bg-muji-bg">
                    <h3 className="font-bold text-lg text-muji-text">{isNew ? '新增股票' : '編輯股票資訊'}</h3>
                    <button onClick={onClose}><LucideIcon name="x" className="w-5 h-5 text-muji-muted" /></button>
                </div>
                <div className="p-6 space-y-4">
                    {/* 新增模式才顯示代號輸入 */}
                    {isNew && (
                        <div className="space-y-1">
                            <label className="text-xs text-muji-muted">代號</label>
                            <input type="text" className="w-full p-2 border border-muji-border rounded uppercase font-mono" placeholder="2330" value={symbol} onChange={e => setSymbol(e.target.value)} />
                        </div>
                    )}
                    
                    <div className="space-y-1">
                        <label className="text-xs text-muji-muted">名稱</label>
                        <input type="text" className="w-full p-2 border border-muji-border rounded" placeholder="台積電" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muji-muted">現價</label>
                        <input type="number" step="0.01" className="w-full p-2 border border-muji-border rounded" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muji-muted">資產類別</label>
                        <div className="flex gap-2">
                            {['個股', 'ETF', '債'].map(t => (
                                <label key={t} className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="editAssetType" value={t} checked={assetType === t} onChange={() => setAssetType(t)} className="accent-muji-accent" />
                                    <span className="text-sm">{t}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muji-muted">配息頻率</label>
                        <div className="flex gap-2 flex-wrap">
                            {['月', '季', '半', '年', ''].map(f => (
                                <label key={f || 'none'} className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="editFreq" value={f} checked={dividendFrequency === f} onChange={() => setDividendFrequency(f)} className="accent-muji-accent" />
                                    <span className="text-sm">{f ? `${f}配` : '無'}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleSave} className="w-full py-3 bg-muji-accent text-white rounded-lg font-bold shadow-sm">{isNew ? '新增' : '儲存'}</button>
                </div>
            </div>
        </div>
    );
};

// --- Helper Component: 日期篩選器 ---
const DateFilter = ({ years, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth }) => (
    <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar items-center">
        <LucideIcon name="filter" className="w-4 h-4 text-muji-muted" />
        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="p-1.5 bg-muji-bg rounded border border-muji-border text-xs font-bold text-muji-text outline-none">
            <option value="all">所有年份</option>
            {years.map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-1.5 bg-muji-bg rounded border border-muji-border text-xs font-bold text-muji-text outline-none">
            <option value="all">所有月份</option>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
        </select>
    </div>
);

// --- 6. 股票明細視圖 ---
const StockDetailView = ({ stock, transactions, dividends, onBack, onAddRecord, onUpdatePrice, onEditRecord, onDeleteRecord, onUpdateFrequency, onBatchImport, onUpdateType, onOpenEdit }) => {
    const [tab, setTab] = useState('trade');
    const [priceInput, setPriceInput] = useState(stock.currentPrice);
    const [selectedYear, setSelectedYear] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState('all');

    const stats = calculateStockFinancials(stock, transactions);

    useEffect(() => { setPriceInput(stock.currentPrice); }, [stock.currentPrice]);
    const handlePriceBlur = () => { if (priceInput !== stock.currentPrice) onUpdatePrice(stock.symbol, parseFloat(priceInput)); };

    const availableYears = useMemo(() => {
        const allDates = [...transactions, ...dividends].map(t => new Date(t.date).getFullYear());
        return [...new Set(allDates)].sort((a,b) => b-a);
    }, [transactions, dividends]);

    const filterData = (list) => {
        return list.filter(item => {
            const d = new Date(item.date);
            const y = d.getFullYear().toString();
            const m = (d.getMonth() + 1).toString();
            if (selectedYear !== 'all' && y !== selectedYear) return false;
            if (selectedMonth !== 'all' && m !== selectedMonth) return false;
            return true;
        });
    };

    const filteredTransactions = useMemo(() => filterData(transactions), [transactions, selectedYear, selectedMonth]);
    const filteredDividends = useMemo(() => filterData(dividends), [dividends, selectedYear, selectedMonth]);
    const totalFilteredDividends = useMemo(() => filteredDividends.reduce((sum, d) => sum + (d.amount || 0), 0), [filteredDividends]);

    return (
        <div className="h-full flex flex-col bg-white animate-fade relative">
            <div className="flex-shrink-0 bg-white z-20 shadow-sm">
                <div className="p-4 border-b border-muji-border flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 -ml-2 hover:bg-muji-bg rounded-full"><LucideIcon name="arrow-left" className="w-6 h-6 text-muji-text" /></button>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="bg-muji-accent text-white text-xs px-2 py-0.5 rounded font-mono">{stock.symbol}</span>
                                <h3 className="font-bold text-lg text-muji-text">{stock.name}</h3>
                                <button onClick={() => onOpenEdit(stock)} className="ml-2 p-1 hover:bg-muji-bg rounded-full text-muji-muted hover:text-muji-accent"><LucideIcon name="pencil" className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => onBatchImport(stock)} className="bg-white border border-muji-border text-muji-text px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-muji-bg flex items-center gap-2 text-xs whitespace-nowrap"><LucideIcon name="file-up" className="w-4 h-4" /> 匯入</button>
                        <button onClick={() => onAddRecord({ symbol: stock.symbol, name: stock.name, assetType: stock.assetType })} className="bg-muji-accent text-white px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-opacity-90 flex items-center gap-2 text-xs whitespace-nowrap"><LucideIcon name="plus" className="w-4 h-4" /> 新增</button>
                    </div>
                </div>

                <div className="p-5 m-4 mb-2 bg-muji-bg/50 rounded-xl border border-muji-border space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        <div className="text-center">
                            <div className="text-xs text-muji-muted mb-1">持有股數</div>
                            <div className="font-bold font-mono text-xl text-muji-text">{stock.quantity.toLocaleString()}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-muji-muted mb-1">目前股價 {stock.lastUpdateDate && <span className="text-[10px] opacity-75">({stock.lastUpdateDate})</span>}</div>
                            <div className="flex items-center justify-center gap-1">
                                <span className="font-mono text-xl text-muji-text">$</span>
                                <input type="number" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} onBlur={handlePriceBlur} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} className="font-bold font-mono text-xl text-muji-text bg-transparent border-b border-dashed border-muji-muted w-24 text-center focus:outline-none focus:border-muji-accent" />
                            </div>
                        </div>
                        <div className="text-center"><div className="text-xs text-muji-muted mb-1">目前市值</div><div className="font-bold font-mono text-xl text-muji-text">${Math.round(stats.marketValue).toLocaleString()}</div></div>
                        <div className="text-center"><div className="text-xs text-muji-muted mb-1">報酬率％</div><div className={`font-bold font-mono text-xl ${stats.returnRate >= 0 ? 'text-muji-red' : 'text-muji-green'}`}>{stats.returnRate > 0 ? '+' : ''}{stats.returnRate.toFixed(2)}%</div></div>
                        <div className="text-center"><div className="text-xs text-muji-muted mb-1">未實現損益</div><div className={`font-bold font-mono text-xl ${stats.unrealizedProfit >= 0 ? 'text-muji-red' : 'text-muji-green'}`}>{stats.unrealizedProfit > 0 ? '+' : ''}{Math.round(stats.unrealizedProfit).toLocaleString()}</div></div>
                        <div className="text-center"><div className="text-xs text-muji-muted mb-1">已實現損益</div><div className={`font-bold font-mono text-xl ${stats.realizedProfit >= 0 ? 'text-muji-red' : 'text-muji-green'}`}>{stats.realizedProfit > 0 ? '+' : ''}{Math.round(stats.realizedProfit).toLocaleString()}</div></div>
                    </div>
                    <div className="border-t border-muji-border pt-4">
                        <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                            <div className="flex items-center justify-between md:justify-start md:gap-4">
                                <span className="text-xs text-muji-muted font-bold">配息頻率</span>
                                <div className="flex gap-2">{['月', '季', '半', '年'].map(freq => (<label key={freq} className="flex items-center gap-1 cursor-pointer"><input type="radio" name="frequency" value={freq} checked={stock.dividendFrequency === freq} onChange={() => onUpdateFrequency(stock.symbol, freq)} className="accent-muji-accent" /><span className="text-xs text-muji-text">{freq}配</span></label>))}</div>
                            </div>
                            <div className="hidden md:block w-[1px] bg-muji-border h-4 self-center"></div>
                            <div className="flex items-center justify-between md:justify-start md:gap-4">
                                <span className="text-xs text-muji-muted font-bold">資產類別</span>
                                <div className="flex gap-2">{['個股', 'ETF', '債'].map(type => (<label key={type} className="flex items-center gap-1 cursor-pointer"><input type="radio" name="assetType" value={type} checked={stock.assetType === type || (!stock.assetType && type === '個股')} onChange={() => onUpdateType(stock.symbol, type)} className="accent-muji-accent" /><span className="text-xs text-muji-text">{type}</span></label>))}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex border-b border-muji-border mx-4">
                    <button onClick={() => setTab('trade')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 ${tab === 'trade' ? 'border-muji-accent text-muji-text' : 'border-transparent text-muji-muted'}`}><LucideIcon name="arrow-right-left" className="w-4 h-4" /> 買賣明細</button>
                    <button onClick={() => setTab('dividend')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 ${tab === 'dividend' ? 'border-muji-accent text-muji-text' : 'border-transparent text-muji-muted'}`}><LucideIcon name="coins" className="w-4 h-4" /> 股息紀錄<span className="ml-2 font-mono text-emerald-600 font-normal opacity-80">(累積: ${totalFilteredDividends.toLocaleString()})</span></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-20">
                <DateFilter years={availableYears} selectedYear={selectedYear} setSelectedYear={setSelectedYear} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />
                {tab === 'trade' ? (
                    filteredTransactions.length === 0 ? <div className="text-center text-muji-muted py-10">無符合條件的交易紀錄</div> : filteredTransactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map(tx => (
                        <div key={tx.id} onClick={() => onEditRecord(tx)} className="bg-white p-4 rounded-xl border border-muji-border flex justify-between items-center shadow-sm group hover:border-muji-accent cursor-pointer transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs ${tx.type === 'buy' ? 'bg-muji-red' : 'bg-muji-green'}`}>{tx.type === 'buy' ? '買' : '賣'}</div>
                                <div><div className="font-mono text-sm font-bold text-muji-text">{tx.date}</div><div className="text-xs text-muji-muted">{tx.quantity}股 @ ${tx.price}</div></div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right"><div className="font-mono font-bold text-muji-text">${(tx.totalAmount || 0).toLocaleString()}</div><div className="text-[10px] text-muji-muted">費: {tx.fee}</div></div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); onDeleteRecord(tx.id); }} className="p-1.5 text-muji-muted hover:text-red-500 hover:bg-red-50 rounded"><LucideIcon name="trash-2" className="w-4 h-4" /></button></div>
                            </div>
                        </div>
                    ))
                ) : (
                    filteredDividends.length === 0 ? <div className="text-center text-muji-muted py-10">無符合條件的股息紀錄</div> : filteredDividends.sort((a,b) => new Date(b.date) - new Date(a.date)).map(div => (
                        <div key={div.id} onClick={() => onEditRecord({ id: div.id, date: div.date, type: 'dividend', symbol: stock.symbol, name: stock.name, amount: div.amount, accountId: div.accountId })} className="bg-white p-4 rounded-xl border border-muji-border flex justify-between items-center shadow-sm hover:border-muji-accent cursor-pointer transition-colors">
                            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600"><LucideIcon name="gift" className="w-5 h-5" /></div><div><div className="font-mono text-sm font-bold text-muji-text">{div.date}</div><div className="text-xs text-muji-muted">{div.note}</div></div></div>
                            <div className="font-mono font-bold text-emerald-600">+${div.amount.toLocaleString()}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// --- 7. 主視圖 ---
window.WealthView = ({ data, saveData, showToast }) => {
    const [showTradeModal, setShowTradeModal] = useState(false);
    const [showBatchImport, setShowBatchImport] = useState(false);
    const [activeStock, setActiveStock] = useState(null); 
    const [tradeInitialData, setTradeInitialData] = useState(null); 
    const [importTargetStock, setImportTargetStock] = useState(null); 
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, type: null });
    const [assetTypeFilter, setAssetTypeFilter] = useState('全部');
    const [dividendFreqFilter, setDividendFreqFilter] = useState('全部');
    const [stockToEdit, setStockToEdit] = useState(null); 
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'descending' });

    const userAccounts = data.accounts.filter(a => a.userId === data.currentUser || (!a.userId && data.currentUser === 'default'));
    const stocks = data.stocks.filter(s => s.userId === data.currentUser || (!s.userId && data.currentUser === 'default'));
    const stockTransactions = data.stockTransactions || [];
    const mainTransactions = data.transactions || [];

    const getStockDividends = (stock) => mainTransactions.filter(tx => tx.type === 'income' && tx.categoryId.includes('股息') && (tx.note.includes(stock.symbol) || tx.note.includes(stock.name)));

    const updateStockFromHistory = (symbol, newTransactions, newAssetTypeOverride = null) => {
        const oldStock = stocks.find(s => s.symbol === symbol);
        const currentPrice = oldStock ? oldStock.currentPrice : 0;
        const lastUpdateDate = oldStock ? oldStock.lastUpdateDate : null;
        const dividendFrequency = oldStock ? oldStock.dividendFrequency : '';
        const assetType = newAssetTypeOverride || (oldStock ? oldStock.assetType : '個股');
        // 保存舊名稱作為 fallback
        const originalName = oldStock ? oldStock.name : '';

        const calculatedStock = recalculateStockState(symbol, newTransactions, currentPrice, originalName);
        calculatedStock.userId = data.currentUser;
        if(lastUpdateDate) calculatedStock.lastUpdateDate = lastUpdateDate;
        if(dividendFrequency) calculatedStock.dividendFrequency = dividendFrequency;
        if(assetType) calculatedStock.assetType = assetType;
        
        const otherStocks = data.stocks.filter(s => s.symbol !== symbol || (s.userId !== data.currentUser && data.currentUser !== 'default'));
        // 修正：不再因為股數為 0 就移除股票，確保賣出後仍能看到已實現損益或保留項目
        let newStockList = [...otherStocks, calculatedStock];
        
        return newStockList;
    };

    const handleSaveRecord = (record) => {
        if (record.type === 'dividend') {
            const newTx = { id: record.id || Date.now().toString(), date: record.date, type: 'income', amount: record.amount, categoryId: 'passive_股息', accountId: record.accountId, note: `股息 ${record.symbol} ${record.name}`, userId: data.currentUser };
            const isEdit = data.transactions.some(t => t.id === newTx.id);
            let newMainTransactions = isEdit ? data.transactions.map(t => t.id === newTx.id ? newTx : t) : [...data.transactions, newTx];
            saveData({ ...data, transactions: newMainTransactions });
            showToast('股息紀錄已更新');
        } else {
            let newStockTransactions = [...stockTransactions];
            const existingIndex = newStockTransactions.findIndex(t => t.id === record.id);
            if (existingIndex >= 0) newStockTransactions[existingIndex] = record; else newStockTransactions.push(record);
            const newStocks = updateStockFromHistory(record.symbol, newStockTransactions, record.assetType);
            saveData({ ...data, stocks: newStocks, stockTransactions: newStockTransactions });
            showToast(`交易已儲存：${record.symbol}`);
            const updatedStock = newStocks.find(s => s.symbol === record.symbol);
            if (activeStock && activeStock.symbol === record.symbol) setActiveStock(updatedStock || null);
        }
        setShowTradeModal(false);
        setTradeInitialData(null);
    };

    const handleDeleteRecord = (id) => {
        setDeleteConfirm({ show: true, id, type: 'stock_tx' });
    };

    const confirmDelete = () => {
        const id = deleteConfirm.id;
        const tx = stockTransactions.find(t => t.id === id);
        if (!tx) return;
        const newStockTransactions = stockTransactions.filter(t => t.id !== id);
        const newStocks = updateStockFromHistory(tx.symbol, newStockTransactions);
        saveData({ ...data, stocks: newStocks, stockTransactions: newStockTransactions });
        showToast('交易已刪除，庫存已重算');
        const updatedStock = newStocks.find(s => s.symbol === tx.symbol);
        setActiveStock(updatedStock || null);
        setDeleteConfirm({ show: false, id: null, type: null });
    };

    const handleUpdatePrice = (symbol, newPrice) => {
        const now = new Date();
        const dateStr = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
        const newStocks = stocks.map(s => s.symbol === symbol ? { ...s, currentPrice: newPrice, lastUpdateDate: dateStr } : s);
        saveData({ ...data, stocks: newStocks });
        if (activeStock && activeStock.symbol === symbol) setActiveStock({ ...activeStock, currentPrice: newPrice, lastUpdateDate: dateStr });
    };

    const handleUpdateFrequency = (symbol, freq) => {
        const newStocks = stocks.map(s => s.symbol === symbol ? { ...s, dividendFrequency: freq } : s);
        saveData({ ...data, stocks: newStocks });
        if (activeStock && activeStock.symbol === symbol) setActiveStock({ ...activeStock, dividendFrequency: freq });
        showToast('配息頻率已更新');
    };

    const handleUpdateType = (symbol, type) => {
        const newStocks = stocks.map(s => s.symbol === symbol ? { ...s, assetType: type } : s);
        saveData({ ...data, stocks: newStocks });
        if (activeStock && activeStock.symbol === symbol) setActiveStock({ ...activeStock, assetType: type });
        showToast('資產類別已更新');
    };

    const handleStockEditSave = (updatedStock) => {
        const isNew = !stocks.some(s => s.symbol === updatedStock.symbol);
        if (isNew) {
             const now = new Date();
             const dateStr = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
             const newStockEntry = { ...updatedStock, userId: data.currentUser, quantity: 0, avgCost: 0, lastUpdateDate: updatedStock.currentPrice ? dateStr : null };
             saveData({ ...data, stocks: [...stocks, newStockEntry] });
             showToast('已新增股票');
        } else {
             const newStocks = stocks.map(s => s.symbol === updatedStock.symbol ? updatedStock : s);
             saveData({ ...data, stocks: newStocks });
             showToast('股票資訊已更新');
             if (activeStock && activeStock.symbol === updatedStock.symbol) setActiveStock(updatedStock);
        }
        setStockToEdit(null);
    };

    const handleBatchImport = (importedTransactions) => {
        if (importedTransactions.length === 0) { showToast('無有效交易資料', 'error'); return; }
        const newStockTxs = importedTransactions.filter(t => t.type !== 'dividend').map(tx => ({ ...tx, id: `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, userId: data.currentUser }));
        const newDividendTxs = importedTransactions.filter(t => t.type === 'dividend').map(tx => ({ id: `import_div_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, date: tx.date, type: 'income', amount: tx.amount, categoryId: 'passive_股息', accountId: userAccounts[0]?.id || '', note: `股息 ${tx.symbol} ${tx.name}`, userId: data.currentUser }));
        const affectedSymbols = new Set(newStockTxs.map(t => t.symbol));
        let allStockTransactions = [...stockTransactions, ...newStockTxs];
        let currentStocks = [...stocks];
        affectedSymbols.forEach(symbol => {
            const oldStock = currentStocks.find(s => s.symbol === symbol);
            const calculated = recalculateStockState(symbol, allStockTransactions, oldStock?.currentPrice || 0);
            calculated.userId = data.currentUser;
            if(oldStock?.lastUpdateDate) calculated.lastUpdateDate = oldStock.lastUpdateDate;
            if(oldStock?.dividendFrequency) calculated.dividendFrequency = oldStock.dividendFrequency;
            const assetType = oldStock ? oldStock.assetType : '個股';
            if(assetType) calculated.assetType = assetType;
            currentStocks = currentStocks.filter(s => s.symbol !== symbol);
            // 修正：批次匯入後即使股數為 0 也保留（例如只匯入賣出紀錄補登）
            currentStocks.push(calculated);
        });
        saveData({ ...data, stocks: currentStocks, stockTransactions: allStockTransactions, transactions: [...mainTransactions, ...newDividendTxs] });
        showToast(`成功匯入 ${importedTransactions.length} 筆資料`);
        setShowBatchImport(false);
        setImportTargetStock(null);
        if (activeStock && affectedSymbols.has(activeStock.symbol)) {
            const updated = currentStocks.find(s => s.symbol === activeStock.symbol);
            setActiveStock(updated || null);
        }
    };

    const summary = useMemo(() => {
        let totalVal = 0; let totalCost = 0; let totalUnrealizedProfit = 0; let totalRealizedProfit = 0;
        stocks.forEach(s => {
            const stats = calculateStockFinancials(s, stockTransactions.filter(t => t.symbol === s.symbol));
            totalVal += stats.marketValue; totalCost += stats.totalCost; totalUnrealizedProfit += stats.unrealizedProfit; totalRealizedProfit += stats.realizedProfit;
        });
        const totalProfit = totalUnrealizedProfit + totalRealizedProfit;
        const totalReturnRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
        return { totalVal, totalProfit, totalReturnRate };
    }, [stocks, stockTransactions]);

    // Sorting Helper
    const handleSort = (key) => {
        let direction = 'descending';
        if (sortConfig.key === key && sortConfig.direction === 'descending') {
            direction = 'ascending';
        }
        setSortConfig({ key, direction });
    };

    // Processed Stocks (Filter & Sort)
    const processedStocks = useMemo(() => {
        // 1. Calculate stats for all first
        const withStats = stocks.map(s => {
            const stats = calculateStockFinancials(s, stockTransactions.filter(t => t.symbol === s.symbol));
            return { ...s, ...stats };
        });

        // 2. Filter
        const filtered = withStats.filter(s => {
            const matchAsset = assetTypeFilter === '全部' || (s.assetType || '個股') === assetTypeFilter;
            const freq = s.dividendFrequency || '';
            const matchFreq = dividendFreqFilter === '全部' || (dividendFreqFilter === '不配息' ? !freq : freq === dividendFreqFilter);
            return matchAsset && matchFreq;
        });

        // 3. Sort
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];
                
                // String comparison for symbol/name
                if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }

                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }, [stocks, stockTransactions, assetTypeFilter, dividendFreqFilter, sortConfig]);

    // NEW: Split stocks
    const activeStocks = useMemo(() => processedStocks.filter(s => s.quantity > 0), [processedStocks]);
    const inactiveStocks = useMemo(() => processedStocks.filter(s => s.quantity <= 0), [processedStocks]);

    // Sort Icon Component
    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span className="inline-block w-4"></span>; // Placeholder
        return <span className="inline-block ml-1">{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>;
    };

    // Header Click Handler Wrapper
    const HeaderCell = ({ label, sortKey, className = "" }) => (
        <th 
            className={`p-4 bg-muji-bg cursor-pointer hover:bg-gray-100 select-none ${className}`} 
            onClick={() => handleSort(sortKey)}
        >
            <div className="flex items-center justify-center gap-1">
                {label} <SortIcon column={sortKey} />
            </div>
        </th>
    );

    const renderStockRow = (s, isInactive = false) => {
        const rowBg = s.assetType === 'ETF' ? 'bg-emerald-50/30' : (s.assetType === '債' ? 'bg-amber-50/30' : 'bg-white');
        const inactiveClass = isInactive ? 'opacity-60 grayscale-[0.5]' : '';
        return (
            <tr key={s.symbol} className={`hover:bg-muji-hover transition-colors cursor-pointer ${rowBg} ${inactiveClass}`} onClick={() => setActiveStock(s)}>
                <td className="p-4 text-center"><div className="font-bold font-mono text-base">{s.symbol}</div><div className="text-xs text-muji-muted">{s.name}</div></td>
                <td className="p-4 text-center font-mono">{s.quantity.toLocaleString()}</td>
                <td className="p-4 text-center font-mono text-muji-muted">${s.avgCost.toFixed(2)}</td>
                <td className="p-4 text-center font-mono font-bold">${s.currentPrice}<div className="text-[10px] text-muji-muted font-normal">{s.lastUpdateDate}</div></td>
                <td className="p-4 text-center font-mono font-bold text-muji-text">${Math.round(s.marketValue).toLocaleString()}</td>
                <td className={`p-4 text-center font-mono font-bold ${s.returnRate >= 0 ? 'text-muji-red' : 'text-muji-green'}`}>{s.returnRate > 0 ? '+' : ''}{s.returnRate.toFixed(2)}%</td>
                <td className={`p-4 text-center font-mono font-bold ${s.unrealizedProfit >= 0 ? 'text-muji-red' : 'text-muji-green'}`}>{s.unrealizedProfit >= 0 ? '+' : ''}{Math.round(s.unrealizedProfit).toLocaleString()}</td>
                <td className={`p-4 text-center font-mono font-bold ${s.realizedProfit >= 0 ? 'text-muji-red' : 'text-muji-green'}`}>{s.realizedProfit >= 0 ? '+' : ''}{Math.round(s.realizedProfit).toLocaleString()}</td>
            </tr>
        );
    };

    const renderStockCard = (s, isInactive = false) => {
        const cardBg = s.assetType === 'ETF' ? 'bg-emerald-50/30' : (s.assetType === '債' ? 'bg-amber-50/30' : 'bg-white');
        const inactiveClass = isInactive ? 'opacity-60 grayscale-[0.5]' : '';
        return (
            <div key={s.symbol} onClick={() => setActiveStock(s)} className={`${cardBg} ${inactiveClass} p-4 rounded-xl border border-muji-border shadow-sm active:scale-95 transition-transform cursor-pointer relative group`}>
                <div className="flex justify-between items-start mb-2 pr-2">
                    <div className="flex items-center gap-2"><span className="bg-muji-bg text-muji-text font-bold px-2 py-1 rounded font-mono text-sm">{s.symbol}</span><span className="font-bold text-muji-text">{s.name}</span></div>
                    <div className={`text-right font-mono font-bold ${s.unrealizedProfit >= 0 ? 'text-muji-red' : 'text-muji-green'}`}>{s.unrealizedProfit >= 0 ? '+' : ''}{Math.round(s.unrealizedProfit).toLocaleString()}<div className="text-xs opacity-70">{s.returnRate.toFixed(1)}%</div></div>
                </div>
                <div className="flex justify-between items-end text-sm mt-4">
                    <div><div className="text-muji-muted text-xs">市值 ${Math.round(s.marketValue).toLocaleString()}</div><div className="text-muji-muted text-xs">均價 ${s.avgCost.toFixed(1)}</div></div>
                    <div className="text-right"><div className="text-muji-muted text-xs mb-0.5">現價 ${s.currentPrice}</div><div className="font-mono font-bold text-lg text-muji-text">{s.quantity.toLocaleString()}</div></div>
                </div>
                <div className="mt-2 pt-2 border-t border-muji-border flex justify-between items-center text-xs">
                    <span className="text-muji-muted">已實現損益</span>
                    <span className={`font-mono font-bold ${s.realizedProfit >= 0 ? 'text-muji-red' : 'text-muji-green'}`}>{s.realizedProfit >= 0 ? '+' : ''}{Math.round(s.realizedProfit).toLocaleString()}</span>
                </div>
            </div>
        );
    };

    if (activeStock) {
        return (
            <>
                <StockDetailView stock={activeStock} transactions={stockTransactions.filter(t => t.symbol === activeStock.symbol)} dividends={getStockDividends(activeStock)} onBack={() => setActiveStock(null)} onAddRecord={(prefillData) => { setTradeInitialData(prefillData); setShowTradeModal(true); }} onUpdatePrice={handleUpdatePrice} onEditRecord={(tx) => { setTradeInitialData(tx); setShowTradeModal(true); }} onDeleteRecord={handleDeleteRecord} onUpdateFrequency={handleUpdateFrequency} onUpdateType={handleUpdateType} onBatchImport={(targetStock) => { setImportTargetStock(targetStock); setShowBatchImport(true); }} onOpenEdit={setStockToEdit} />
                {showTradeModal && <TradeModal onClose={() => setShowTradeModal(false)} onSave={handleSaveRecord} accounts={userAccounts} initialData={tradeInitialData} />}
                {showBatchImport && <BatchImportModal onClose={() => { setShowBatchImport(false); setImportTargetStock(null); }} onImport={handleBatchImport} defaultSymbol={importTargetStock?.symbol} defaultName={importTargetStock?.name} />}
                {deleteConfirm.show && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop"><div className="bg-white p-6 rounded-xl shadow-xl border border-muji-border w-full max-w-sm"><h4 className="font-bold text-lg mb-2 text-muji-text">確認刪除</h4><p className="text-sm text-muji-muted mb-4">確定要刪除這筆交易嗎？<br/>刪除後系統將自動重新計算平均成本。</p><div className="flex gap-3"><button onClick={() => setDeleteConfirm({ show: false, id: null })} className="flex-1 py-2 rounded-lg border border-muji-border text-muji-muted hover:bg-muji-bg">取消</button><button onClick={confirmDelete} className="flex-1 py-2 rounded-lg bg-muji-red text-white font-bold shadow-sm">確認刪除</button></div></div></div>}
                {stockToEdit && <StockEditModal stock={stockToEdit} onClose={() => setStockToEdit(null)} onSave={handleStockEditSave} />}
            </>
        );
    }

    return (
        <div className="p-6 md:p-10 animate-fade space-y-4 pb-24 h-full flex flex-col">
            <div className="flex-shrink-0 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div><h3 className="text-2xl font-bold text-muji-text">股票庫存</h3><p className="text-sm text-muji-muted mt-1">長期持有，複利滾存</p></div>
                    <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <div className="bg-white px-4 py-2 rounded-lg border border-muji-border flex-shrink-0"><div className="text-xs text-muji-muted">總市值</div><div className="text-lg font-bold font-mono text-muji-text">${Math.round(summary.totalVal).toLocaleString()}</div></div>
                        <div className={`px-4 py-2 rounded-lg border flex-shrink-0 ${summary.totalProfit >= 0 ? 'bg-muji-red/10 border-muji-red/20 text-muji-red' : 'bg-muji-green/10 border-muji-green/20 text-muji-green'}`}><div className="text-xs opacity-70">總損益</div><div className="text-lg font-bold font-mono">{summary.totalProfit >= 0 ? '+' : ''}{Math.round(summary.totalProfit).toLocaleString()}</div></div>
                        <div className={`px-4 py-2 rounded-lg border flex-shrink-0 ${summary.totalReturnRate >= 0 ? 'bg-muji-red/10 border-muji-red/20 text-muji-red' : 'bg-muji-green/10 border-muji-green/20 text-muji-green'}`}><div className="text-xs opacity-70">總報酬率</div><div className="text-lg font-bold font-mono">{summary.totalReturnRate >= 0 ? '+' : ''}{summary.totalReturnRate.toFixed(2)}%</div></div>
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-2 w-full">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            {['全部', '個股', 'ETF', '債'].map(filter => (<button key={filter} onClick={() => setAssetTypeFilter(filter)} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${assetTypeFilter === filter ? 'bg-muji-text text-white border-muji-text' : 'bg-white text-muji-muted border-muji-border hover:bg-muji-bg'}`}>{filter}</button>))}
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            {['全部', '月配', '季配', '半年配', '年配', '不配息'].map(filter => (<button key={filter} onClick={() => setDividendFreqFilter(filter)} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${dividendFreqFilter === filter ? 'bg-muji-text text-white border-muji-text' : 'bg-white text-muji-muted border-muji-border hover:bg-muji-bg'}`}>{filter}</button>))}
                        </div>
                    </div>
                    <button onClick={() => setStockToEdit({ symbol: '', name: '', currentPrice: '', assetType: '個股', dividendFrequency: '' })} className="bg-muji-accent text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm hover:bg-opacity-90 flex items-center gap-1 flex-shrink-0 whitespace-nowrap ml-2 self-start"><LucideIcon name="plus" className="w-3 h-3" /> 新增股票</button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative flex flex-col rounded-xl border border-muji-border bg-white shadow-sm">
                <div className="hidden md:block flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm text-muji-text relative">
                        <thead className="bg-muji-bg text-muji-muted font-medium border-b border-muji-border sticky top-0 z-10 shadow-sm">
                            <tr>
                                <HeaderCell label="代號 / 名稱" sortKey="symbol" />
                                <HeaderCell label="持有股數" sortKey="quantity" />
                                <HeaderCell label="平均成本" sortKey="avgCost" />
                                <HeaderCell label="現價" sortKey="currentPrice" />
                                <HeaderCell label="目前市值" sortKey="marketValue" />
                                <HeaderCell label="報酬率％" sortKey="returnRate" />
                                <HeaderCell label="未實現損益" sortKey="unrealizedProfit" />
                                <HeaderCell label="已實現損益" sortKey="realizedProfit" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-muji-border">
                            {activeStocks.map(s => renderStockRow(s))}
                            
                            {inactiveStocks.length > 0 && (
                                <tr>
                                    <td colSpan="8" className="bg-gray-50 text-center py-2 text-xs font-bold text-muji-muted border-t border-b border-muji-border">
                                        已出清 / 觀察中 ({inactiveStocks.length})
                                    </td>
                                </tr>
                            )}
                            {inactiveStocks.map(s => renderStockRow(s, true))}
                            
                            {processedStocks.length === 0 && <tr><td colSpan="8" className="p-8 text-center text-muji-muted">無符合條件的項目</td></tr>}
                        </tbody>
                    </table>
                </div>
                <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-4">
                    {activeStocks.map(s => renderStockCard(s))}
                    
                    {inactiveStocks.length > 0 && (
                        <div className="text-center py-2 text-xs font-bold text-muji-muted bg-gray-50 rounded-lg border border-muji-border">
                            已出清 / 觀察中 ({inactiveStocks.length})
                        </div>
                    )}
                    {inactiveStocks.map(s => renderStockCard(s, true))}
                    
                    {processedStocks.length === 0 && <div className="text-center text-muji-muted py-10 bg-muji-card rounded-xl border border-dashed border-muji-border">無符合條件的項目</div>}
                </div>
            </div>
            
            {showBatchImport && <BatchImportModal onClose={() => { setShowBatchImport(false); setImportTargetStock(null); }} onImport={handleBatchImport} defaultSymbol={null} />}
            {showTradeModal && <TradeModal onClose={() => setShowTradeModal(false)} onSave={handleSaveRecord} accounts={userAccounts} initialData={tradeInitialData} />}
            {stockToEdit && <StockEditModal stock={stockToEdit} onClose={() => setStockToEdit(null)} onSave={handleStockEditSave} />}
            {deleteConfirm.show && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop"><div className="bg-white p-6 rounded-xl shadow-xl border border-muji-border w-full max-w-sm"><h4 className="font-bold text-lg mb-2 text-muji-text">確認刪除</h4><p className="text-sm text-muji-muted mb-4">確定要刪除這筆交易嗎？<br/>刪除後系統將自動重新計算平均成本。</p><div className="flex gap-3"><button onClick={() => setDeleteConfirm({ show: false, id: null })} className="flex-1 py-2 rounded-lg border border-muji-border text-muji-muted hover:bg-muji-bg">取消</button><button onClick={confirmDelete} className="flex-1 py-2 rounded-lg bg-muji-red text-white font-bold shadow-sm">確認刪除</button></div></div></div>}
        </div>
    );
};