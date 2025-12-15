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

        // Modification 1: Removed logic that creates adjustment repayment/expense for settlement
        // We only record the actual repayment amount now.
        
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
    
    // Render detail list
    const renderDetailList = () => {
        if (!viewingTarget) return null;
        const txs = getTargetTransactions(viewingTarget);
        
        let selectedTotal = 0;
        txs.forEach(tx => {
            if(selectedDebtTxIds.includes(tx.id)) {
                 if (tx.type === 'advance') selectedTotal += tx.amount;
                 else if (tx.type === 'expense') {
                      const split = tx.splits?.find(s => s.name === viewingTarget);
                      if (split) selectedTotal += parseFloat(split.amount);
                 }
            }
        });

        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-lg">{viewingTarget} 明細</div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar space-y-2 p-1 border border-muji-border rounded-lg">
                    <div className="flex justify-between items-center p-2 bg-muji-bg rounded-t-lg">
                         <button onClick={() => toggleSelectAll(txs)} className="text-xs text-muji-accent underline font-bold px-1">
                             {selectedDebtTxIds.length === txs.filter(t => t.type !== 'repay').length ? '取消全選' : '全選未還'}
                         </button>
                         <span className="text-xs text-muji-muted">點擊明細可編輯</span>
                    </div>
                    {txs.map(tx => { 
                        let amount = 0; 
                        let label = ''; 
                        let isDebt = false;

                        if(tx.type === 'advance') { amount = tx.amount; label = '代墊借出'; isDebt = true; } 
                        else if(tx.type === 'repay') { amount = tx.amount; label = '已還款'; } 
                        else if (tx.type === 'expense') { 
                            // Ensure splits and split amounts exist before accessing
                            const split = tx.splits?.find(s => s.name === viewingTarget); 
                            amount = parseFloat(split?.amount || 0); 
                            label = '分帳支出'; 
                            isDebt = true;
                        } 
                        
                        return (
                            <div 
                                key={tx.id} 
                                className={`flex items-center p-3 border rounded-lg transition-colors ${isDebt ? 'bg-white border-muji-border' : 'bg-teal-50/20 border-teal-200 opacity-75'}`}
                                onClick={() => { 
                                    // Modification 2: Click anywhere on the row (except checkbox) opens edit
                                    setViewingTarget(null); // Close the detail modal
                                    openEditTransaction(tx); // Open the transaction edit modal
                                }}
                            >
                                {isDebt && (
                                    <input 
                                        type="checkbox" 
                                        className="mr-3 w-5 h-5 accent-muji-accent"
                                        checked={selectedDebtTxIds.includes(tx.id)}
                                        onChange={() => toggleSelectTx(tx.id)}
                                        onClick={(e) => e.stopPropagation()} // Stop propagation to prevent opening edit modal when clicking checkbox
                                    />
                                )}
                                <div className="flex-1 cursor-pointer">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="text-xs text-muji-muted mb-0.5">{tx.date} <span className="ml-2 font-bold">{label}</span></div>
                                            {tx.note && <div className="text-sm text-muji-text font-medium mt-0.5">{tx.note}</div>}
                                        </div>
                                        <div className={`font-mono font-bold ${isDebt ? 'text-orange-500' : 'text-teal-600'}`}>
                                            {isDebt ? '+' : '-'}${amount.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ); 
                    })}
                </div>
                
                {/* Repay Action Area */}
                <div className="pt-4 border-t border-muji-border">
                    <div className="flex flex-col gap-3">
                         <div className="flex justify-between items-center text-sm font-bold">
                             <span>選取總額: <span className="text-muji-muted font-normal">${selectedTotal.toLocaleString()}</span></span>
                         </div>
                         <div className="flex items-center gap-2">
                             <label className="text-sm font-bold whitespace-nowrap">實際還款:</label>
                             <input 
                                type="number" 
                                className="flex-1 p-2 bg-white rounded border border-muji-border text-sm font-mono font-bold text-muji-accent"
                                placeholder="輸入金額"
                                value={repayAmount}
                                onChange={(e) => setRepayAmount(e.target.value)}
                             />
                         </div>
                         <select className="w-full p-2 bg-muji-card rounded border border-muji-border text-sm" value={repayAccountId} onChange={e => setRepayAccountId(e.target.value)}>
                            <option value="">選擇存入帳戶 (還款來源)...</option>
                            {userAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                         </select>
                         <button onClick={handlePreRepay} disabled={selectedDebtTxIds.length === 0 || !repayAccountId} className={`w-full py-3 rounded-lg font-bold shadow-sm text-white ${selectedDebtTxIds.length > 0 && repayAccountId ? 'bg-muji-accent' : 'bg-gray-300'}`}>
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
    };

    return (
        <React.Fragment> 
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
                {viewingTarget && <window.Modal title={`${viewingTarget} 的往來明細`} onClose={() => setViewingTarget(null)}>{renderDetailList()}</window.Modal>}
            </div>
        </React.Fragment>
    );
};