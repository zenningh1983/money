const { useState, useEffect, useMemo, useCallback } = React;

window.WealthView = ({ data, saveData, showToast }) => {
    const [showTrade, setShowTrade] = useState(false);
    const [trade, setTrade] = useState({ symbol: '', name: '', price: '', quantity: '', type: 'buy' });

    const getCurrentUserStocks = () => data.stocks.filter(s => s.userId === data.currentUser || (!s.userId && data.currentUser === 'default'));
    const stocks = getCurrentUserStocks();

    useEffect(() => { window.refreshIcons(); }, [showTrade]);

    const handleTrade = () => {
        if (!trade.symbol || !trade.price || !trade.quantity) return;
        const price = parseFloat(trade.price); const qty = parseInt(trade.quantity);
        const newTx = { ...trade, id: Date.now().toString(), price, quantity: qty, date: new Date().toISOString(), userId: data.currentUser };
        let newStocks = [...data.stocks];
        const existing = newStocks.find(s => s.symbol === trade.symbol && (s.userId === data.currentUser || (!s.userId && data.currentUser === 'default')));
        
        if (trade.type === 'buy') {
            if (existing) {
                const totalCost = (existing.avgCost * existing.quantity) + (price * qty);
                existing.quantity += qty; existing.avgCost = totalCost / existing.quantity;
            } else newStocks.push({ id: Date.now().toString(), symbol: trade.symbol, name: trade.name || trade.symbol, quantity: qty, avgCost: price, currentPrice: price, userId: data.currentUser });
        } else {
            if (existing && existing.quantity >= qty) {
                existing.quantity -= qty; if (existing.quantity === 0) newStocks = newStocks.filter(s => s.id !== existing.id);
            } else { showToast('庫存不足', 'error'); return; }
        }
        saveData({ ...data, stocks: newStocks, stockTransactions: [...data.stockTransactions, newTx] });
        setShowTrade(false); setTrade({ symbol: '', name: '', price: '', quantity: '', type: 'buy' });
    };

    const totalWealth = stocks.reduce((sum, s) => sum + (s.quantity * s.currentPrice), 0);
    const totalCost = stocks.reduce((sum, s) => sum + (s.quantity * s.avgCost), 0);
    const profit = totalWealth - totalCost;
    const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    return (
        <div className="p-6 md:p-10 animate-fade space-y-8">
            <div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                    <div><h3 className="text-2xl font-bold text-muji-text">股票庫存</h3><p className="text-sm text-muji-muted mt-1">長期持有，複利滾存</p></div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <div className="bg-white px-4 py-2 rounded-lg text-right flex-1 md:flex-none border border-muji-border"><div className="text-xs text-muji-muted">總市值</div><div className="text-lg font-bold font-mono text-muji-text">${totalWealth.toLocaleString()}</div></div>
                        <div className={`px-4 py-2 rounded-lg text-right flex-1 md:flex-none border ${profit >= 0 ? 'bg-muji-green/10 border-muji-green/20 text-muji-green' : 'bg-muji-red/10 border-muji-red/20 text-muji-red'}`}><div className="text-xs opacity-70">損益</div><div className="text-lg font-bold font-mono">{profit >= 0 ? '+' : ''}{profit.toLocaleString()} ({profitPercent.toFixed(1)}%)</div></div>
                        <button onClick={() => setShowTrade(true)} className="bg-muji-accent text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-opacity-90">交易</button>
                    </div>
                </div>
                <div className="hidden md:block overflow-hidden rounded-xl border border-muji-border">
                    <table className="w-full text-left text-sm text-muji-text"><thead className="bg-white text-muji-muted font-medium"><tr><th className="p-4">代號</th><th className="p-4">名稱</th><th className="p-4 text-right">股數</th><th className="p-4 text-right">均價</th><th className="p-4 text-right">現價</th><th className="p-4 text-right">損益</th></tr></thead><tbody className="divide-y divide-muji-border bg-white">{stocks.map(s => { const stockProfit = (s.currentPrice - s.avgCost) * s.quantity; return (<tr key={s.symbol} className="hover:bg-muji-hover"><td className="p-4 font-bold font-mono">{s.symbol}</td><td className="p-4">{s.name}</td><td className="p-4 text-right font-mono">{s.quantity}</td><td className="p-4 text-right font-mono text-muji-muted">${s.avgCost.toFixed(1)}</td><td className="p-4 text-right font-mono font-bold">${s.currentPrice}</td><td className={`p-4 text-right font-mono font-bold ${stockProfit >= 0 ? 'text-muji-green' : 'text-muji-red'}`}>{stockProfit >= 0 ? '+' : ''}{stockProfit.toLocaleString()}</td></tr>); })}</tbody></table>
                </div>
                <div className="md:hidden grid gap-3">{stocks.map(s => { const stockProfit = (s.currentPrice - s.avgCost) * s.quantity; return (<div key={s.symbol} className="bg-white p-4 rounded-xl border border-muji-border shadow-sm flex justify-between items-center"><div><div className="flex items-center gap-2"><span className="font-bold text-lg font-mono">{s.symbol}</span><span className="text-xs bg-muji-bg px-2 py-0.5 rounded text-muji-muted">{s.name}</span></div><div className="text-xs text-muji-muted mt-1 font-mono">{s.quantity} 股 • 均價 ${s.avgCost.toFixed(1)}</div></div><div className="text-right"><div className="font-bold text-lg font-mono">${s.currentPrice}</div><div className={`text-xs font-bold font-mono ${stockProfit >= 0 ? 'text-muji-green' : 'text-muji-red'}`}>{stockProfit >= 0 ? '+' : ''}{stockProfit.toLocaleString()} ({((stockProfit/(s.avgCost*s.quantity))*100).toFixed(1)}%)</div></div></div>) })}</div>
            </div>
            {showTrade && (
                <window.Modal title="新增交易" onClose={() => setShowTrade(false)}>
                    <div className="space-y-4">
                        <div className="flex bg-muji-bg rounded-lg p-1">
                            {['buy', 'sell'].map(t => {
                                const isSelected = trade.type === t;
                                let btnClass = "flex-1 py-2 rounded text-sm font-bold transition ";
                                if (isSelected) {
                                    btnClass += t === 'buy' ? 'bg-muji-red text-white' : 'bg-muji-green text-white';
                                } else {
                                    btnClass += 'text-muji-muted hover:bg-muji-card';
                                }
                                return (
                                    <button key={t} className={btnClass} onClick={() => setTrade({...trade, type: t})}>
                                        {t === 'buy' ? '買入' : '賣出'}
                                    </button>
                                );
                            })}
                        </div>
                        <input className="w-full p-3 bg-white rounded-lg font-mono text-muji-text border border-muji-border" placeholder="代號 (e.g., 2330)" value={trade.symbol} onChange={e => setTrade({...trade, symbol: e.target.value.toUpperCase()})} />
                        <input className="w-full p-3 bg-white rounded-lg text-muji-text border border-muji-border" placeholder="名稱 (選填)" value={trade.name} onChange={e => setTrade({...trade, name: e.target.value})} />
                        <div className="flex gap-2">
                            <input type="number" className="flex-1 p-3 bg-white rounded-lg font-mono text-muji-text border border-muji-border" placeholder="價格" value={trade.price} onChange={e => setTrade({...trade, price: e.target.value})} />
                            <input type="number" className="flex-1 p-3 bg-white rounded-lg font-mono text-muji-text border border-muji-border" placeholder="股數" value={trade.quantity} onChange={e => setTrade({...trade, quantity: e.target.value})} />
                        </div>
                        <button onClick={handleTrade} className="w-full py-3 bg-muji-accent text-white rounded-lg font-bold shadow-sm">確認</button>
                    </div>
                </window.Modal>
            )}
        </div>
    );
};