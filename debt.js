const { useState, useEffect, useMemo, useCallback } = React;

window.DebtView = ({ data, saveData, showToast, openEditTransaction }) => {
    const [viewingTarget, setViewingTarget] = useState(null);
    const [repayAccountId, setRepayAccountId] = useState('');
    const [selectedDebtTxIds, setSelectedDebtTxIds] = useState([]);
    const [repayAmount, setRepayAmount] = useState('');
    const [showSettlementConfirm, setShowSettlementConfirm] = useState(false);
    const [settlementDiff, setSettlementDiff] = useState(0);
    
    const userAccounts = data.accounts.filter(a => a.userId === data.currentUser || (!a.userId && data.currentUser === 'default'));
    const debts = window.getDebtSummary(data, data.currentUser);
    const categoryGroups = data.settings?.categoryGroups || window.DEFAULT_CATEGORY_GROUPS;
    const flatCategories = useMemo(() => window.getFlatCategories(categoryGroups), [categoryGroups]);

    useEffect(() => { window.refreshIcons(); }, [viewingTarget]);

    const getTargetTransactions = (targetName) => {
        return data.transactions.filter(t => {
            const account = data.accounts.find(a => a.id === t.accountId);
            const isOwner = account && account.userId === data.currentUser;
            const isDirectDebt = (t.type === 'advance' || t.type === 'repay') && t.targetName === targetName;
            const isSplitDebt = t.type === 'expense' && t.splits && t.splits.some(s => s.name === targetName);
            return isOwner && (isDirectDebt || isSplitDebt);
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    // Calculate total whenever selection changes
    useEffect(() => {
        if (!viewingTarget) return;
        const txs = getTargetTransactions(viewingTarget);
        let total = 0;
        txs.forEach(tx => {
            if (selectedDebtTxIds.includes(tx.id)) {
                 if (tx.type === 'advance') total += tx.amount;
                 else if (tx.type === 'expense') {
                      const split = tx.splits?.find(s => s.name === viewingTarget);
                      if (split) total += parseFloat(split.amount);
                 }
            }
        });
        setRepayAmount(total > 0 ? total.toString() : '');
    }, [selectedDebtTxIds, viewingTarget]);

    const handlePreRepay = () => {
        if(!repayAccountId) return showToast('請選擇存入帳戶', 'error');
        if(selectedDebtTxIds.length === 0) return showToast('請選擇要還款的項目', 'error');
        
        const enteredAmount = parseFloat(repayAmount);
        if (isNaN(enteredAmount) || enteredAmount <= 0) return showToast('無效的還款金額', 'error');

        // Calculate actual selected sum
        const targetTxs = getTargetTransactions(viewingTarget);
        let selectedTotal = 0;
        targetTxs.forEach(tx => {
            if (selectedDebtTxIds.includes(tx.id)) {
                 if (tx.type === 'advance') selectedTotal += tx.amount;
                 else if (tx.type === 'expense') {
                      const split = tx.splits?.find(s => s.name === viewingTarget);
                      if (split) selectedTotal += parseFloat(split.amount);
                 }
            }
        });

        // Check if amount matches
        const diff = selectedTotal - enteredAmount;
        if (Math.abs(diff) > 0) {
            setSettlementDiff(diff);
            setShowSettlementConfirm(true);
        } else {
            doRepay(false);
        }
    };

    const doRepay = (isSettlement) => {
        const enteredAmount = parseFloat(repayAmount);
        const newTxs = [];
        
        // 1. Main Repayment Transaction
        newTxs.push({ 
            id: Date.now().toString(), 
            date: new Date().toISOString().split('T')[0], 
            type: 'repay', 
            accountId: repayAccountId, 
            amount: enteredAmount, 
            targetName: viewingTarget, 
            note: `${viewingTarget} 債務結算 (還款)`, 
            categoryId: '' 
        });

        saveData({ ...data, transactions: [...data.transactions, ...newTxs] }); 
        setViewingTarget(null); 
        setSelectedDebtTxIds([]);
        setShowSettlementConfirm(false);
        setSettlementDiff(0);
        setRepayAmount('');
        showToast('還款已記錄');
    };

    const toggleSelectTx = (id) => {
        if (selectedDebtTxIds.includes(id)) {
            setSelectedDebtTxIds(selectedDebtTxIds.filter(tid => tid !== id));
        } else {
            setSelectedDebtTxIds([...selectedDebtTxIds, id]);
        }
    };

    const toggleSelectAll = (targetTransactions) => {
         // Only select positive debts (advances/expenses), ignoring repays
         const debtIds = targetTransactions.filter(t => t.type !== 'repay').map(t => t.id);
         if (selectedDebtTxIds.length === debtIds.length) {
             setSelectedDebtTxIds([]);
         } else {
             setSelectedDebtTxIds(debtIds);
         }
    };
    
    // If viewing a target, show the Detail View (Full Page)
    if (viewingTarget) {
        const txs = getTargetTransactions(viewingTarget);
        const debtTxs = txs.filter(t => t.type !== 'repay');
        const selectedTotal = txs.reduce((acc, tx) => {
            if(selectedDebtTxIds.includes(tx.id)) {
                 if (tx.type === 'advance') return acc + tx.amount;
                 if (tx.type === 'expense') {
                      const split = tx.splits?.find(s => s.name === viewingTarget);
                      return acc + (parseFloat(split?.amount || 0));
                 }
            }
            return acc;
        }, 0);

        return (
            <div className="pb-24 md:pb-0 animate-fade flex flex-col h-full relative">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 px-4 md:px-0 pt-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setViewingTarget(null)} 
                            className="p-2 hover:bg-black/5 rounded-full transition-colors"
                        >
                            <i data-lucide="arrow-left" className="w-6 h-6 text-muji-text"></i>
                        </button>
                        <h3 className="text-2xl font-bold text-muji-text flex-1">{viewingTarget} 的往來明細</h3>
                    </div>
                </div>

                {/* Table Container - Matches Accounting View Structure exactly (Div Grid Layout) */}
                <div className="flex-1 overflow-auto bg-white mx-4 md:mx-0 mb-20 md:mb-0 rounded-xl border border-muji-border min-h-[50vh] max-h-[calc(100vh-250px)] relative flex flex-col">
                    <div className="bg-muji-bg text-muji-muted font-medium border-b border-muji-border flex text-sm shadow-sm z-20 sticky top-0 grid grid-cols-[5rem_6rem_4rem_7rem_6rem_6rem_1fr] items-center">
                        <div className="p-4 flex justify-center">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 accent-muji-accent cursor-pointer"
                                checked={debtTxs.length > 0 && selectedDebtTxIds.length === debtTxs.length}
                                onChange={() => toggleSelectAll(txs)}
                            />
                        </div>
                        <div className="p-4 text-center">日期</div>
                        <div className="p-4 text-center">類型</div>
                        <div className="p-4 text-center">分類</div>
                        <div className="p-4 text-right">金額</div>
                        <div className="p-4 text-right"></div>
                        <div className="p-4 text-left pl-4">備註</div>
                    </div>
                    <div>
                        {/* Body using Divs and Grid */}
                        {txs.length === 0 ? <div className="p-10 text-center text-muji-muted">無交易紀錄</div> : txs.map(tx => { 
                            let amount = 0; 
                            let catName = ''; 
                            let isDebt = false;
                            let typeLabel = ''; 
                            let typeColor = '';

                            if(tx.type === 'advance') { 
                                amount = tx.amount; 
                                catName = '代墊'; 
                                typeLabel = '代墊';
                                typeColor = 'text-orange-500';
                                isDebt = true; 
                            } else if(tx.type === 'repay') { 
                                amount = tx.amount; 
                                catName = '還款'; 
                                typeLabel = '還款';
                                typeColor = 'text-teal-600';
                            } else if (tx.type === 'expense') { 
                                const split = tx.splits?.find(s => s.name === viewingTarget); 
                                amount = parseFloat(split?.amount || 0); 
                                const cat = flatCategories[tx.categoryId] || {};
                                catName = cat.name || '分帳';
                                typeLabel = '分帳'; 
                                typeColor = 'text-rose-500';
                                isDebt = true;
                            } 
                            
                            return (
                                <div 
                                    key={tx.id} 
                                    className={`grid grid-cols-[5rem_6rem_4rem_7rem_6rem_6rem_1fr] items-center border-b border-muji-border/50 hover:bg-muji-hover transition-colors cursor-pointer text-sm ${!isDebt ? 'bg-teal-50/30' : ''}`}
                                    onClick={() => openEditTransaction(tx)}
                                >
                                    <div className="p-4 flex justify-center" onClick={(e) => e.stopPropagation()}>
                                        {isDebt && (
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 accent-muji-accent cursor-pointer"
                                                checked={selectedDebtTxIds.includes(tx.id)}
                                                onChange={() => toggleSelectTx(tx.id)}
                                            />
                                        )}
                                    </div>
                                    <div className="p-4 text-center font-mono text-xs">{tx.date}</div>
                                    <div className={`p-4 text-center font-bold ${typeColor} text-xs px-1 whitespace-nowrap`}>{typeLabel}</div>
                                    <div className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${!isDebt ? 'bg-teal-100 text-teal-700' : 'bg-muji-bg text-muji-text border border-muji-border'}`}>
                                            {catName}
                                        </span>
                                    </div>
                                    <div className={`p-4 text-right font-mono font-bold ${isDebt ? 'text-orange-500' : 'text-teal-600'}`}>
                                        {isDebt ? '+' : '-'}{amount.toLocaleString()}
                                    </div>
                                    <div className="p-4 text-right"></div>
                                    <div className="p-4 text-left text-muji-muted truncate pl-4">{tx.note || '-'}</div>
                                </div>
                            ); 
                        })}
                    </div>
                </div>

                {/* Fixed Bottom Action Bar */}
                <div className="bg-white p-4 rounded-xl border border-muji-border shadow-lg space-y-4 mx-4 md:mx-0 mb-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
                        <div className="flex-1 w-full space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-muji-muted">選取總額</span>
                                <span className="font-mono font-bold text-muji-text">${selectedTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-bold whitespace-nowrap text-muji-text">實際還款</label>
                                <input 
                                    type="number" 
                                    className="flex-1 p-2 bg-muji-bg rounded border border-muji-border text-sm font-mono font-bold text-muji-accent focus:border-muji-accent outline-none"
                                    placeholder="輸入金額"
                                    value={repayAmount}
                                    onChange={(e) => setRepayAmount(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 w-full">
                            <select 
                                className="w-full p-2.5 bg-muji-bg rounded border border-muji-border text-sm text-muji-text focus:border-muji-accent outline-none" 
                                value={repayAccountId} 
                                onChange={e => setRepayAccountId(e.target.value)}
                            >
                                <option value="">選擇存入帳戶 (還款來源)...</option>
                                {userAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <button 
                            onClick={handlePreRepay} 
                            disabled={selectedDebtTxIds.length === 0 || !repayAccountId} 
                            className={`w-full md:w-auto px-6 py-2.5 rounded-lg font-bold shadow-sm text-white transition-colors whitespace-nowrap ${selectedDebtTxIds.length > 0 && repayAccountId ? 'bg-muji-accent hover:opacity-90' : 'bg-gray-300 cursor-not-allowed'}`}
                        >
                            確認還款
                        </button>
                    </div>
                </div>

                {/* Settlement Confirm Modal */}
                {showSettlementConfirm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-pop">
                        <div className="bg-white p-6 rounded-xl shadow-xl border border-muji-border w-full max-w-sm">
                            <h4 className="font-bold text-lg mb-2 text-muji-text">金額不符確認</h4>
                            <p className="text-sm text-muji-muted mb-4">
                                選取債務: ${parseFloat(repayAmount) + settlementDiff}<br/>
                                實際還款: ${parseFloat(repayAmount)}<br/>
                                差額: <span className="text-muji-red font-bold">${settlementDiff.toLocaleString()}</span><br/><br/>
                                是否確認以<b>「${parseFloat(repayAmount).toLocaleString()}」</b>進行還款？<br/>
                                <span className="text-xs text-muji-muted">(剩餘差額將保留在債務中)</span>
                            </p>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => doRepay(true)} className="w-full py-2 rounded-lg bg-muji-accent text-white font-bold shadow-sm">確認還款</button>
                                <button onClick={() => setShowSettlementConfirm(false)} className="w-full py-2 text-xs text-muji-muted underline">取消</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Default Debt List View
    return (
        <div className="p-6 md:p-10 animate-fade space-y-8">
            <h3 className="text-2xl font-bold text-muji-text mb-4">債務管理</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(debts).map(([name, amount]) => {
                    if (amount === 0) return null;
                    return (
                        <div key={name} onClick={() => { setViewingTarget(name); setSelectedDebtTxIds([]); }} className="bg-muji-card p-5 rounded-xl border border-muji-border shadow-sm flex flex-col justify-between h-32 cursor-pointer hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start"><div className="font-bold text-lg text-muji-text group-hover:text-muji-accent transition-colors">{name}</div><span className={`text-xs px-2 py-1 rounded ${amount > 0 ? 'bg-orange-100 text-orange-600 border border-orange-500/30' : 'bg-teal-100 text-teal-600 border border-teal-500/30'}`}>{amount > 0 ? '欠款' : '溢繳'}</span></div>
                            <div className="flex justify-between items-end"><div className={`text-2xl font-mono font-bold ${amount > 0 ? 'text-orange-500' : 'text-teal-400'}`}>${Math.abs(amount).toLocaleString()}</div><div className="text-xs text-muji-muted">點擊查看/還款</div></div>
                        </div>
                    );
                })}
                {Object.keys(debts).length === 0 && <div className="col-span-full text-center py-8 text-muji-muted border border-dashed border-muji-border rounded-xl">目前沒有債務紀錄</div>}
            </div>
        </div>
    );
};