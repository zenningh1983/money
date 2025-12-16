const { useState, useEffect, useMemo, useCallback } = React;

window.AppLayout = ({ children, view, setView, syncStatus, selectedAccount, setSelectedAccount, data, onOpenQuickAdd }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const currentUser = data.users.find(u => u.id === data.currentUser);
    
    // HeaderStatus Component for Date & Sync
    const HeaderStatus = () => (
        <div className="flex items-center gap-3">
             <div className="text-xs font-mono text-muji-muted tracking-wider">
                {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
             </div>
             <div title={syncStatus} className={`p-2 rounded-full bg-white transition-colors duration-300 border border-muji-border ${syncStatus === 'syncing' ? 'text-muji-accent animate-spin' : 'text-muji-muted'}`}>
                <i data-lucide="refresh-cw" className="w-4 h-4"></i>
             </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-muji-bg text-muji-text font-sans flex justify-center md:items-center md:py-10 transition-all duration-300">
            <div className={`w-full md:max-w-6xl md:h-[85vh] bg-muji-bg md:bg-white md:rounded-2xl md:shadow-xl md:flex md:border border-muji-border overflow-hidden relative`}>
                <div className={`hidden md:flex ${isCollapsed ? 'w-20' : 'w-48'} bg-muji-sidebar border-r border-muji-border flex-col p-4 space-y-4 transition-all duration-300 ease-in-out relative`}>
                    <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -right-3 top-8 bg-white border border-muji-border rounded-full p-1 shadow-sm text-muji-muted hover:text-muji-accent z-10 hidden md:block"><i data-lucide={isCollapsed ? "chevrons-right" : "chevrons-left"} className="w-4 h-4"></i></button>
                    <div className={`flex items-center gap-2 mb-2 ${isCollapsed ? 'justify-center' : ''}`}>
                        <div className="w-8 h-8 bg-muji-accent rounded-full flex items-center justify-center text-white flex-shrink-0"><i data-lucide="coins" className="w-5 h-5"></i></div>
                        {!isCollapsed && (<div><h1 className="text-lg font-bold text-muji-text leading-tight font-mono tracking-wider">{currentUser?.name}</h1></div>)}
                    </div>
                    <div className="space-y-1">
                        {[ { id: 'dashboard', label: '總覽', icon: 'layout-grid' }, { id: 'accounting', label: '記帳', icon: 'notebook-pen' }, { id: 'debt', label: '債務', icon: 'hand-coins' }, { id: 'wealth', label: '理財', icon: 'trending-up' } ].map(item => (
                            <button key={item.id} onClick={() => { setView(item.id); if(item.id === 'dashboard' || item.id === 'accounting') setSelectedAccount(null); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${view === item.id ? 'bg-white shadow-sm text-muji-accent font-bold shadow-[0_0_15px_rgba(14,165,233,0.3)]' : 'text-muji-muted hover:bg-muji-hover'} ${isCollapsed ? 'justify-center px-0' : ''}`} title={isCollapsed ? item.label : ''}>
                                <i data-lucide={item.icon} className="w-5 h-5 flex-shrink-0"></i> {!isCollapsed && <span>{item.label}</span>}
                            </button>
                        ))}
                    </div>
                    <div className="mt-auto pt-4 border-t border-muji-border"><button onClick={() => setView('settings')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${view === 'settings' ? 'bg-white shadow-sm text-muji-accent font-bold' : 'text-muji-muted hover:bg-muji-hover'} ${isCollapsed ? 'justify-center px-0' : ''}`} title={isCollapsed ? '設定' : ''}><i data-lucide="settings" className="w-5 h-5 flex-shrink-0"></i> {!isCollapsed && <span>設定</span>}</button></div>
                </div>
                <div className="flex-1 flex flex-col h-full bg-muji-bg relative overflow-hidden">
                    
                    {/* Date & Sync Status (Floating top-right for both Mobile & Desktop) */}
                    <div className="absolute top-6 right-6 z-20 flex items-center gap-4">
                         <HeaderStatus />
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar md:p-8 pt-16 md:pt-8">{children}</div>
                    
                    {/* Bottom Navigation for Mobile - Only Dashboard and Accounting */}
                    <div className="md:hidden fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-muji-border p-2 pb-6 flex justify-around items-center z-30">
                        <button onClick={() => { setView('dashboard'); setSelectedAccount(null); }} className={`flex flex-col items-center p-2 rounded-lg w-16 transition ${view === 'dashboard' ? 'text-muji-accent' : 'text-muji-muted'}`}><i data-lucide="layout-grid" className="w-6 h-6"></i><span className="text-[10px] mt-1 font-medium">總覽</span></button>
                        <button onClick={() => { setView('accounting'); setSelectedAccount(null); }} className={`flex flex-col items-center p-2 rounded-lg w-16 transition ${view === 'accounting' ? 'text-muji-accent' : 'text-muji-muted'}`}><i data-lucide="notebook-pen" className="w-6 h-6"></i><span className="text-[10px] mt-1 font-medium">記帳</span></button>
                    </div>

                </div>
            </div>
        </div>
    );
};

window.DashboardView = ({ data, setData, saveData, setView, setSelectedAccount, setInputModal, showToast, dailyQuote }) => {
    const getCurrentUserAccounts = () => data.accounts.filter(a => a.userId === data.currentUser || (!a.userId && data.currentUser === 'default'));
    const getCurrentUserStocks = () => data.stocks.filter(s => s.userId === data.currentUser || (!s.userId && data.currentUser === 'default'));
    const totalAssets = getCurrentUserAccounts().reduce((sum, acc) => sum + window.calculateBalance(data, acc.id), 0) + getCurrentUserStocks().reduce((sum, s) => sum + (s.quantity * s.currentPrice), 0);
    const monthlyStats = window.calculateMonthlyStats(data);
    const [showAssets, setShowAssets] = useState(false);
    const [isLedgerOpen, setIsLedgerOpen] = useState(false); 

    useEffect(() => { window.refreshIcons(); }, [showAssets, isLedgerOpen]);
    
    const handleLedgerChange = (userId) => {
         const newData = {...data, currentUser: userId};
         saveData(newData);
         setIsLedgerOpen(false);
         showToast('切換成功');
    };

    return (
        <div className="p-6 space-y-8 animate-fade h-full flex flex-col justify-center max-w-4xl mx-auto pb-24" onClick={() => isLedgerOpen && setIsLedgerOpen(false)}>
            <div className="mb-4 text-center">
                <h2 className="text-3xl font-bold text-muji-text mb-2 font-mono tracking-widest">通往財富自由之路</h2>
                <p className="text-muji-accent text-sm font-mono tracking-widest uppercase">{dailyQuote}</p>
            </div>
            <div className="flex justify-center relative z-20">
                <div 
                    className="bg-white border border-muji-border rounded-full py-2 px-6 flex items-center gap-3 shadow-lg shadow-black/20 hover:border-muji-accent transition-colors cursor-pointer group"
                    onClick={(e) => { e.stopPropagation(); setIsLedgerOpen(!isLedgerOpen); }}
                >
                    <span className="text-muji-muted text-sm font-medium">帳本</span>
                    <div className="h-4 w-[1px] bg-muji-border"></div>
                    <div className="text-sm text-muji-accent font-bold text-center min-w-[3rem]">{data.users.find(u => u.id === data.currentUser)?.name}</div>
                    <i data-lucide={isLedgerOpen ? "chevron-up" : "chevron-down"} className="w-3 h-3 text-muji-muted"></i>
                </div>
                
                {isLedgerOpen && (
                    <div className="absolute top-full mt-2 bg-white border border-muji-border rounded-xl shadow-xl py-2 min-w-[200px] animate-pop flex flex-col z-30">
                        {data.users.map(u => (
                            <button 
                                key={u.id} 
                                onClick={(e) => { e.stopPropagation(); handleLedgerChange(u.id); }}
                                className={`px-4 py-3 text-left text-sm hover:bg-muji-bg transition-colors flex justify-between items-center ${u.id === data.currentUser ? 'text-muji-accent font-bold' : 'text-muji-text'}`}
                            >
                                <span>{u.name}</span>
                                {u.id === data.currentUser && <i data-lucide="check" className="w-3 h-3"></i>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Total Assets Card - Resized to match Debt Management card height (h-32) */}
            <div className="bg-white rounded-2xl p-6 text-center shadow-[0_0_30px_rgba(14,165,233,0.1)] border border-muji-border relative h-32 flex flex-col justify-center items-center backdrop-blur-sm z-10">
                <div className="text-muji-muted text-sm font-medium mb-2 flex items-center justify-center gap-2 font-mono tracking-widest uppercase">
                    總資產 
                    <button onClick={(e) => { e.stopPropagation(); setShowAssets(!showAssets); }} className="hover:text-muji-accent transition p-1 rounded-full flex items-center justify-center w-6 h-6" key={`eye-${showAssets}`}>
                        {showAssets ? <i data-lucide="eye" className="w-4 h-4"></i> : <i data-lucide="eye-off" className="w-4 h-4"></i>}
                    </button>
                </div>
                <div className="text-5xl font-bold text-muji-text tracking-tighter tabular-nums font-mono drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{showAssets ? `$${totalAssets.toLocaleString()}` : '****'}</div>
            </div>

            {monthlyStats.expense > monthlyStats.income && (
                <div className="w-full md:w-2/3 mx-auto bg-muji-red/10 border border-muji-red/20 rounded-xl p-3 flex items-center justify-center gap-2 text-muji-red text-sm animate-pop font-medium">
                    <i data-lucide="alert-circle" className="w-4 h-4"></i> 
                    <span>本月已超支 ${(monthlyStats.expense - monthlyStats.income).toLocaleString()}，請注意消費！</span>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 w-full md:w-2/3 mx-auto z-10">
                {/* Income Box - Soft Green Style */}
                <div className="bg-emerald-50/30 p-4 rounded-xl border border-emerald-100/50 shadow-sm flex flex-col items-center">
                    <span className="text-xs text-emerald-600/70 mb-1 font-mono font-bold">收入</span>
                    <span className="text-lg font-bold text-emerald-700 font-mono">+${monthlyStats.income.toLocaleString()}</span>
                </div>
                {/* Expense Box - Soft Red Style */}
                <div className="bg-rose-50/30 p-4 rounded-xl border border-rose-100/50 shadow-sm flex flex-col items-center">
                    <span className="text-xs text-rose-600/70 mb-1 font-mono font-bold">支出</span>
                    <span className="text-lg font-bold text-rose-700 font-mono">-${monthlyStats.expense.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
};

// Main App component definition must follow all view component definitions.
window.App = () => {
    const [view, setView] = useState('dashboard'); 
    const [data, setData] = useState(window.INITIAL_DATA);
    const [githubToken, setGithubToken] = useState(localStorage.getItem('gh_token') || (window.DEFAULT_TOKEN_SUFFIX ? `ghp_${window.DEFAULT_TOKEN_SUFFIX}` : ''));
    const [repo, setRepo] = useState(window.DEFAULT_REPO); 
    const [syncStatus, setSyncStatus] = useState('idle'); 
    const [sha, setSha] = useState(null);
    const [toast, setToast] = useState(null);
    const [selectedAccount, setSelectedAccount] = useState(null);
    
    // --- Shared Modal State (Transaction Modal) ---
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [transactionData, setTransactionData] = useState(null);

    const [inputModal, setInputModal] = useState({ show: false, title: '', value: '', type: '', data: null, extra: null });
    const dailyQuote = useMemo(() => { const d = new Date().getDate(); return window.QUOTES[(d - 1) % window.QUOTES.length] || window.QUOTES[0]; }, []);
    const showToast = useCallback((msg, type = 'info') => setToast({ message: msg, type }), []);
    useEffect(() => { if (window.lucide) { window.lucide.createIcons(); setTimeout(() => window.lucide.createIcons(), 50); } });
    
    const fetchData = async (silent = false) => {
        if (!githubToken) return;
        const safeToken = githubToken.replace(/[^\x00-\x7F]/g, "").trim();
        if (!safeToken) return;
        if (!silent) setSyncStatus('syncing');
        try {
            const res = await fetch(`https://api.github.com/repos/${repo}/contents/${window.FILE_PATH}`, { headers: { 'Authorization': `token ${safeToken}`, 'Accept': 'application/vnd.github.v3+json' } });
            if (res.status === 404) { const mergedData = { ...window.INITIAL_DATA }; setData(mergedData); setSyncStatus('success'); return; }
            if (res.status === 401) { if (!silent) showToast('Token 無效', 'error'); setSyncStatus('error'); return; }
            const json = await res.json();
            const content = decodeURIComponent(escape(window.atob(json.content)));
            const parsedData = JSON.parse(content);
            if (!parsedData.settings) parsedData.settings = { categoryGroups: window.DEFAULT_CATEGORY_GROUPS, accountTypes: window.DEFAULT_ACCOUNT_TYPES };
            if (!parsedData.debtTargets) parsedData.debtTargets = window.DEFAULT_DEBT_TARGETS;
            setData(parsedData); setSha(json.sha); setSyncStatus('success');
        } catch (e) { if(!silent) setSyncStatus('error'); }
    };

    const saveData = async (newData = data, showSuccessToast = true, explicitSha = null) => {
        if (!githubToken) { showToast('請設定 Token', 'error'); return; }
        const safeToken = githubToken.replace(/[^\x00-\x7F]/g, "").trim();
        setSyncStatus('syncing');
        try {
            setData(newData);
            const content = window.btoa(unescape(encodeURIComponent(JSON.stringify(newData))));
            const body = { message: `Backup ${new Date().toLocaleString()} [skip ci]`, content: content, sha: explicitSha !== null ? explicitSha : sha };
            if (!body.sha) delete body.sha;
            const res = await fetch(`https://api.github.com/repos/${repo}/contents/${window.FILE_PATH}`, { method: 'PUT', headers: { 'Authorization': `token ${safeToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (res.status === 401) throw new Error("Token 錯誤");
            if (!res.ok) { const errBody = await res.json().catch(() => ({})); throw new Error(`Save failed: ${res.status}`); }
            const json = await res.json();
            setSha(json.content.sha); setSyncStatus('success'); if (showSuccessToast) showToast('已儲存');
        } catch (e) { setSyncStatus('error'); showToast('儲存失敗', 'error'); }
    };

    useEffect(() => { if (githubToken) fetchData(); }, []);
    useEffect(() => { if (githubToken && view !== 'settings') fetchData(true); }, [view]);

    const openEditTransaction = (tx) => {
        setEditMode(true);
        setTransactionData(tx);
        if(tx.accountId) setSelectedAccount(tx.accountId); 
        setIsTransactionModalOpen(true);
    };

    const handleInputConfirm = () => {
        const val = inputModal.value ? inputModal.value.trim() : '';
        
        if (!val && !inputModal.type.includes('delete') && inputModal.type !== 'reset_settings') {
             showToast('請輸入名稱', 'error');
             return;
        }

        let newData = { ...data };
        let successMessage = '更新成功';
        
        switch(inputModal.type) {
            case 'rename_ledger': 
                newData.users = newData.users.map(u => u.id === inputModal.data ? { ...u, name: val } : u);
                successMessage = `帳本名稱已修改為：${val}`;
                break;
                
            case 'delete_ledger': 
                if (newData.users.length <= 1) { 
                    showToast('至少需保留一個帳本', 'error'); 
                    return; 
                }
                newData.users = newData.users.filter(u => u.id !== inputModal.data);
                if (newData.currentUser === inputModal.data) {
                    newData.currentUser = newData.users[0].id;
                }
                successMessage = '帳本已刪除';
                break;
                
            case 'add_account': 
                newData.accounts.push({ 
                    id: `acc_${Date.now()}`, 
                    name: val, 
                    type: inputModal.extra || 'cash', 
                    balance: 0, 
                    userId: newData.currentUser 
                });
                successMessage = '已新增帳戶';
                break;
                
            case 'rename_account': 
                newData.accounts = newData.accounts.map(a => a.id === inputModal.data ? { ...a, name: val, type: inputModal.extra || a.type } : a);
                successMessage = '帳戶名稱已更新';
                break;
                
            case 'delete_account': 
                newData.accounts = newData.accounts.filter(a => a.id !== inputModal.data);
                newData.transactions = newData.transactions.filter(t => t.accountId !== inputModal.data && t.toAccountId !== inputModal.data);
                successMessage = '帳戶已刪除';
                break;

            case 'delete_sub': 
                const { groupId, subName, type } = inputModal.data;
                const group = newData.settings.categoryGroups[type].find(g => g.id === groupId);
                if (group) {
                    group.subs = group.subs.filter(s => s !== subName);
                    successMessage = '子分類已刪除';
                }
                break;

            case 'reset_settings': 
                newData.settings = JSON.parse(JSON.stringify(window.INITIAL_DATA.settings));
                newData.debtTargets = JSON.parse(JSON.stringify(window.DEFAULT_DEBT_TARGETS));
                newData.users = JSON.parse(JSON.stringify(window.INITIAL_DATA.users)); 
                newData.currentUser = window.INITIAL_DATA.currentUser; 
                successMessage = '所有設定與帳本已重置';
                break;

            case 'delete_account_type': 
                delete newData.settings.accountTypes[inputModal.data];
                successMessage = '帳戶類型已刪除';
                break;

            case 'delete_debt_target': 
                const targetId = inputModal.data;
                const target = newData.debtTargets.find(t => t.id === targetId);
                if (target) {
                    const name = target.name;
                    newData.debtTargets = newData.debtTargets.filter(t => t.id !== targetId);
                    newData.transactions = newData.transactions.map(tx => {
                         if (tx.splits && Array.isArray(tx.splits)) {
                             const newSplits = tx.splits.filter(s => s.name !== name);
                             if (newSplits.length !== tx.splits.length) {
                                 return { ...tx, splits: newSplits };
                             }
                         }
                         return tx;
                    }).filter(tx => !((tx.type === 'advance' || tx.type === 'repay') && tx.targetName === name));
                    successMessage = `已刪除 ${name} 及其相關紀錄`;
                }
                break;
                
            default:
                break;
        }
        
        saveData(newData);
        showToast(successMessage);
        setInputModal({ ...inputModal, show: false });
    };

    const closeTransactionModal = () => { 
        setEditMode(false); 
        setTransactionData(null); 
        setIsTransactionModalOpen(false); 
    };

    const handleGlobalSave = (tx, debtTargets) => {
        let updatedTransactions = [...data.transactions];
         updatedTransactions = updatedTransactions.map(t => t.id === tx.id ? tx : t);
         saveData({ ...data, transactions: updatedTransactions, debtTargets });
         closeTransactionModal();
    };

    const handleGlobalDelete = (tx) => {
        const updated = data.transactions.filter(t => t.id !== tx.id);
        saveData({ ...data, transactions: updated });
        closeTransactionModal();
    };
    
    // Fix: Define callbacks at the top level to avoid React Error #310
    const handleSetSplitTotal = useCallback(val => setTransactionData(d => ({...d, amount: parseFloat(val) || 0})), []);
    const handleSetSplits = useCallback(newSplits => setTransactionData(d => ({...d, splits: newSplits})), []);

    return (
        <window.AppLayout 
            view={view} 
            setView={setView} 
            syncStatus={syncStatus} 
            selectedAccount={selectedAccount} 
            setSelectedAccount={setSelectedAccount} 
            data={data}
        >
            {view === 'settings' && <window.SettingsView data={data} githubToken={githubToken} setGithubToken={setGithubToken} repo={repo} saveData={saveData} setInputModal={setInputModal} showToast={showToast} fetchData={fetchData} />}
            {view === 'dashboard' && <window.DashboardView data={data} setData={setData} saveData={saveData} setView={setView} setSelectedAccount={setSelectedAccount} setInputModal={setInputModal} showToast={showToast} dailyQuote={dailyQuote} />}
            {view === 'accounting' && <window.AccountingView data={data} saveData={saveData} selectedAccount={selectedAccount} setSelectedAccount={setSelectedAccount} setInputModal={setInputModal} showToast={showToast} />}
            {view === 'wealth' && <window.WealthView data={data} saveData={saveData} showToast={showToast} />}
            {view === 'debt' && <window.DebtView data={data} saveData={saveData} showToast={showToast} openEditTransaction={openEditTransaction} />}
            
            {toast && <window.Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Input Modal */}
            {inputModal.show && <window.Modal title={inputModal.title} onClose={() => setInputModal({ ...inputModal, show: false })}><div className="space-y-4">{(inputModal.type === 'add_account' || inputModal.type === 'rename_account') && <div className="flex bg-muji-bg rounded-lg p-1 mb-2 overflow-x-auto no-scrollbar">{Object.entries(data.settings?.accountTypes || window.DEFAULT_ACCOUNT_TYPES).map(([key, config]) => (<button key={key} onClick={() => setInputModal({...inputModal, extra: key})} className={`flex-1 min-w-[3rem] py-2 rounded text-xs font-bold transition flex flex-col items-center gap-1 ${inputModal.extra === key || (!inputModal.extra && key === 'cash') ? 'bg-white shadow-sm text-muji-accent' : 'text-muji-muted'}`}><i data-lucide={config.icon} className="w-4 h-4"></i> {config.label}</button>))}</div>}{(inputModal.type.includes('delete') || inputModal.type === 'reset_settings') ? <div className="text-center"><p className="text-muji-muted text-sm mb-4">此操作無法復原。</p><button autoFocus onClick={handleInputConfirm} className="w-full py-3 rounded-lg font-bold shadow-sm text-white bg-muji-red">確認刪除/重置</button></div> : <><input autoFocus className="w-full p-3 bg-muji-bg rounded-lg border-none focus:ring-1 focus:ring-muji-accent" value={inputModal.value} onChange={(e) => setInputModal({ ...inputModal, value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleInputConfirm()} placeholder="請輸入名稱" /><button onClick={handleInputConfirm} className="w-full py-3 rounded-lg font-bold shadow-sm text-white bg-muji-accent">確認</button></>}</div></window.Modal>}
            
            {isTransactionModalOpen && (
                <window.TransactionModal 
                    onClose={closeTransactionModal}
                    isEditMode={editMode}
                    newTx={transactionData || { amount: '', note: '', type: 'expense', categoryId: 'food_伙食', date: new Date().toISOString().split('T')[0], toAccountId: '', targetName: '', splits: [] }}
                    setNewTx={setTransactionData} 
                    isSplitMode={transactionData?.splits?.length > 0} 
                    categoryGroups={data.settings?.categoryGroups || window.DEFAULT_CATEGORY_GROUPS}
                    flatCategories={window.getFlatCategories(data.settings?.categoryGroups || window.DEFAULT_CATEGORY_GROUPS)}
                    userAccounts={data.accounts.filter(a => a.userId === data.currentUser || (!a.userId && data.currentUser === 'default'))}
                    selectedAccount={selectedAccount || (transactionData ? transactionData.accountId : '')} 
                    saveTransaction={handleGlobalSave}
                    handleDeleteTransaction={() => handleGlobalDelete(transactionData)}
                    data={data}
                    saveData={saveData}
                    // Pass callbacks defined at top level
                    splitTotal={transactionData?.amount ? transactionData.amount.toString() : ''}
                    splits={transactionData?.splits || []}
                    setSplitTotal={handleSetSplitTotal}
                    setSplits={handleSetSplits}
                />
            )}
        </window.AppLayout>
    );
};