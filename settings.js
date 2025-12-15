const { useState, useEffect, useMemo, useCallback } = React;

// Move CollapsibleSection outside to prevent re-creation on every render (Fixes Focus Loss/IME issues)
const CollapsibleSection = ({ title, isOpen, onToggle, children }) => (
    <div className="bg-muji-card border border-muji-border rounded-xl shadow-sm overflow-hidden mb-4 transition-all">
        <button 
            onClick={onToggle} 
            className="w-full p-4 flex justify-between items-center bg-muji-bg hover:bg-muji-hover transition-colors"
        >
            <h3 className="font-bold text-lg text-muji-text">{title}</h3>
            <i data-lucide={isOpen ? "chevron-up" : "chevron-down"} className="w-5 h-5 text-muji-muted"></i>
        </button>
        {isOpen && <div className="p-6 border-t border-muji-border animate-fade">{children}</div>}
    </div>
);

window.SettingsView = ({ data, githubToken, setGithubToken, repo, saveData, setInputModal, showToast, fetchData }) => {
    const [showToken, setShowToken] = useState(false); 
    const [tempToken, setTempToken] = useState(githubToken.startsWith('ghp_') ? githubToken.replace(/^ghp_/, '') : githubToken); 
    const [editCategoryType, setEditCategoryType] = useState('expense'); 
    
    // Independent input states for direct input in settings
    const [newAccountTypeLabel, setNewAccountTypeLabel] = useState(''); 
    const [newDebtTarget, setNewDebtTarget] = useState(''); 
    const [newDebtPercent, setNewDebtPercent] = useState('');
    // Fix: Use object for sub-categories to isolate inputs by group ID
    const [newCategorySubs, setNewCategorySubs] = useState({});
    const [newLedgerName, setNewLedgerName] = useState('');
    
    const [expandedSection, setExpandedSection] = useState('ledger'); // Default open Ledger

    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? '' : section);
        window.refreshIcons();
    }
    
    const handleSaveToken = () => { 
        const val = tempToken.trim(); 
        let newToken = (val && (val.startsWith('ghp_') || val.startsWith('github_pat_'))) ? val : (val ? `ghp_${val}` : ''); 
        setGithubToken(newToken); localStorage.setItem('gh_token', newToken); 
        if(newToken) { showToast('連線測試中...'); fetchData().catch(() => showToast('連線失敗', 'error')); } else showToast('Token 已清除'); 
    };

    const ensureSettings = () => { 
        const newData = { ...data }; 
        if (!newData.settings) newData.settings = JSON.parse(JSON.stringify(window.INITIAL_DATA.settings)); 
        if (!newData.settings.accountTypes) newData.settings.accountTypes = window.DEFAULT_ACCOUNT_TYPES; 
        if (!newData.debtTargets) newData.debtTargets = window.DEFAULT_DEBT_TARGETS;
        return newData; 
    }
    
    const handleAddSub = (groupId) => { 
        const val = newCategorySubs[groupId] ? newCategorySubs[groupId].trim() : '';
        if (!val) return showToast('請輸入名稱', 'error');
        const newData = ensureSettings();
        const group = newData.settings.categoryGroups[editCategoryType].find(g => g.id === groupId);
        if(group) { 
            group.subs.push(val); 
            saveData(newData); 
            // Reset specific input
            setNewCategorySubs(prev => ({ ...prev, [groupId]: '' }));
            showToast('已新增小分類'); 
        }
    };

    const handleDeleteSub = (groupId, subName) => { 
        // 改用 Modal 確認
        setInputModal({ 
            show: true, 
            title: `刪除子分類「${subName}」?`, 
            value: '確認', 
            type: 'delete_sub', 
            data: { groupId, subName, type: editCategoryType } 
        });
    };

    const handleResetSettings = () => { 
        // 改用 Modal 確認
        setInputModal({ 
            show: true, 
            title: '重置所有設定與帳本', 
            value: '確認', 
            type: 'reset_settings' 
        });
    };
    
    const handleAddAccountType = () => { 
        if (!newAccountTypeLabel) return showToast('請輸入名稱', 'error'); 
        const newData = ensureSettings(); 
        const newKey = `custom_${Date.now()}`; 
        newData.settings.accountTypes[newKey] = { label: newAccountTypeLabel, icon: 'wallet' }; 
        saveData(newData); setNewAccountTypeLabel(''); showToast('已新增帳戶類型'); 
    }

    const handleDeleteAccountType = (key) => { 
        // 改用 Modal 確認
        setInputModal({ 
            show: true, 
            title: `刪除帳戶類型「${data.settings.accountTypes[key]?.label}」?`, 
            value: '確認', 
            type: 'delete_account_type', 
            data: key 
        });
    }
    
    const handleAddDebtTarget = () => {
         if (!newDebtTarget) return showToast('請輸入名稱', 'error');
         const newData = ensureSettings();
         if(!newData.debtTargets) newData.debtTargets = [];
         
         if (newData.debtTargets.some(t => t.name === newDebtTarget)) {
             return showToast('對象名稱重複', 'error');
         }

         newData.debtTargets.push({ id: `dt_${Date.now()}`, name: newDebtTarget, defaultPercent: newDebtPercent || '' });
         saveData(newData); setNewDebtTarget(''); setNewDebtPercent(''); showToast('已新增對象');
    }

    const handleDeleteDebtTarget = (id) => {
        const target = data.debtTargets.find(t => t.id === id);
        if (!target) return;
        
        // 改用 Modal 確認
        setInputModal({ 
            show: true, 
            title: `刪除對象「${target.name}」?`, 
            value: '確認', 
            type: 'delete_debt_target', 
            data: id 
        });
    }
    
    const handleAddLedger = () => {
        if (!newLedgerName) return showToast('請輸入帳本名稱', 'error');
        const newData = ensureSettings();
        const newUser = { id: `user_${Date.now()}`, name: newLedgerName };
        newData.users.push(newUser); 
        // 修改：新增後不自動切換，保持在當前使用者
        // newData.currentUser = newUser.id;  <-- 移除這行
        saveData(newData); 
        setNewLedgerName(''); 
        showToast(`已建立帳本：${newUser.name}`);
    }

    const categoryGroups = data.settings?.categoryGroups || window.DEFAULT_CATEGORY_GROUPS;
    const accountTypes = data.settings?.accountTypes || window.DEFAULT_ACCOUNT_TYPES;
    const debtTargets = data.debtTargets || window.DEFAULT_DEBT_TARGETS;

    return (
        <div className="p-6 space-y-8 animate-fade pb-20">
            
            {/* 1. 分類管理 */}
            <CollapsibleSection title="分類管理" isOpen={expandedSection === 'category'} onToggle={() => toggleSection('category')}>
                <div className="flex bg-muji-bg rounded-lg p-1 mb-4">
                    <button onClick={() => setEditCategoryType('expense')} className={`flex-1 py-2 rounded text-sm font-bold transition ${editCategoryType === 'expense' ? 'bg-white shadow-sm text-muji-text' : 'text-muji-muted'}`}>支出</button>
                    <button onClick={() => setEditCategoryType('income')} className={`flex-1 py-2 rounded text-sm font-bold transition ${editCategoryType === 'income' ? 'bg-white shadow-sm text-muji-text' : 'text-muji-muted'}`}>收入</button>
                </div>
                <div className="space-y-4">
                    {categoryGroups[editCategoryType].map(group => (
                        <div key={group.id} className="border border-muji-border rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2 font-bold text-muji-text"><i data-lucide={group.icon} className="w-4 h-4"></i> {group.label}</div>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        className="w-24 p-1 bg-muji-bg rounded border-none text-xs text-muji-text" 
                                        placeholder="新子類" 
                                        value={newCategorySubs[group.id] || ''} 
                                        onChange={e => setNewCategorySubs(prev => ({...prev, [group.id]: e.target.value}))} 
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddSub(group.id)} 
                                    />
                                    <button onClick={() => handleAddSub(group.id)} className="text-xs bg-muji-accent text-white px-2 py-1 rounded transition">＋</button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {group.subs.map(sub => (<span key={sub} className="text-xs bg-muji-bg px-2 py-1 rounded flex items-center gap-1 text-muji-text">{sub}<button onClick={() => handleDeleteSub(group.id, sub)} className="text-muji-muted hover:text-muji-red">×</button></span>))}
                                {group.subs.length === 0 && <span className="text-xs text-muji-muted">無小分類</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </CollapsibleSection>
            
            {/* 2. 帳本管理 */}
            <CollapsibleSection title="帳本管理" isOpen={expandedSection === 'ledger'} onToggle={() => toggleSection('ledger')}>
                {data.users.map(u => (
                    <div key={u.id} className="flex justify-between items-center py-3 border-b border-muji-bg last:border-0 hover:bg-muji-hover px-2 rounded transition-colors">
                        <div className="flex items-center gap-3"><span className="font-medium text-muji-text">{u.name}</span><button onClick={() => setInputModal({ show: true, title: '修改名稱', value: u.name, type: 'rename_ledger', data: u.id })} className="text-muji-muted hover:text-muji-accent"><i data-lucide="pencil" className="w-3 h-3"></i></button></div>
                        <div className="flex items-center gap-3">{u.id === data.currentUser ? <span className="text-xs text-muji-green font-bold">使用中</span> : <button onClick={() => setInputModal({ show: true, title: `確定刪除 ${u.name}?`, value: '確認', type: 'delete_ledger', data: u.id })} className="text-muji-muted hover:text-muji-red"><i data-lucide="trash-2" className="w-4 h-4"></i></button>}</div>
                    </div>
                ))}
                <div className="flex gap-2 mt-4">
                    {/* 修改：新增 Enter 鍵觸發 */}
                    <input 
                        className="flex-1 p-2 bg-muji-bg rounded border-none text-sm text-muji-text" 
                        placeholder="新增帳本名稱" 
                        value={newLedgerName} 
                        onChange={e => setNewLedgerName(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && handleAddLedger()}
                    />
                    <button onClick={handleAddLedger} className="bg-muji-accent text-white px-4 py-2 rounded text-sm font-bold">新增帳本</button>
                </div>
            </CollapsibleSection>

            {/* 3. 帳戶類型管理 */}
            <CollapsibleSection title="帳戶類型管理" isOpen={expandedSection === 'account_type'} onToggle={() => toggleSection('account_type')}>
                <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries(accountTypes).map(([key, conf]) => (<div key={key} className="flex items-center gap-2 px-3 py-2 bg-muji-bg rounded-lg text-sm"><i data-lucide={conf.icon} className="w-4 h-4"></i> {conf.label} {['cash', 'bank', 'credit', 'ticket'].indexOf(key) === -1 && <button onClick={() => handleDeleteAccountType(key)} className="text-muji-red ml-1">×</button>}</div>))}
                </div>
                <div className="flex gap-2">
                    <input className="flex-1 p-2 bg-muji-bg rounded border-none text-sm text-muji-text" placeholder="輸入類型名稱" value={newAccountTypeLabel} onChange={e => setNewAccountTypeLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddAccountType()} />
                    <button onClick={handleAddAccountType} className="bg-muji-accent text-white px-4 py-2 rounded text-sm font-bold">新增</button>
                </div>
            </CollapsibleSection>

            {/* 4. 往來對象管理 */}
            <CollapsibleSection title="分帳對象" isOpen={expandedSection === 'debt_targets'} onToggle={() => toggleSection('debt_targets')}>
                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                    {debtTargets.map(t => (<div key={t.id} className="flex justify-between items-center p-2 bg-muji-bg rounded"><div className="flex items-center gap-2"><span className="font-bold">{t.name}</span>{t.defaultPercent && <span className="text-xs bg-muji-accent text-white px-1.5 rounded">{t.defaultPercent}%</span>}</div><button onClick={() => handleDeleteDebtTarget(t.id)} className="text-muji-muted hover:text-muji-red"><i data-lucide="trash-2" className="w-4 h-4"></i></button></div>))}
                </div>
                <div className="flex flex-col gap-2 p-3 bg-muji-bg rounded-lg">
                    <div className="flex gap-2">
                        <input className="flex-1 p-2 bg-white rounded border-none text-sm text-muji-text" placeholder="名稱 (如: 朋友A)" value={newDebtTarget} onChange={e => setNewDebtTarget(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddDebtTarget()} />
                        <input type="number" className="w-20 p-2 bg-white rounded border-none text-sm text-muji-text" placeholder="預設%" value={newDebtPercent} onChange={e => setNewDebtPercent(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddDebtTarget()} />
                    </div>
                    <button onClick={handleAddDebtTarget} className="w-full py-2 bg-muji-accent text-white rounded text-sm font-bold">新增對象</button>
                </div>
            </CollapsibleSection>

            {/* 5. GitHub Settings */}
            <CollapsibleSection title="雲端同步設定 (GitHub)" isOpen={expandedSection === 'token'} onToggle={() => toggleSection('token')}>
                <div className="space-y-4">
                    <div><label className="block text-sm text-muji-muted mb-2">GitHub Token</label><div className="relative"><span className="absolute left-3 top-3 text-muji-muted select-none">ghp_</span><input type={showToken ? "text" : "password"} className="w-full p-3 pl-12 pr-12 bg-muji-bg rounded-lg border border-transparent focus:border-muji-accent focus:ring-0 transition-colors font-mono text-sm" value={tempToken} onChange={e => setTempToken(e.target.value)} placeholder="輸入後碼" /><button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-3 text-muji-muted hover:text-muji-text"><i data-lucide={showToken ? "eye-off" : "eye"} className="w-4 h-4"></i></button></div></div>
                    <button onClick={handleSaveToken} className="w-full py-3 bg-muji-accent text-white font-bold rounded-lg hover:bg-opacity-90 transition shadow-sm">儲存並測試</button>
                </div>
            </CollapsibleSection>

            <div className="mt-8 text-center pb-8"><button onClick={handleResetSettings} className="text-xs text-muji-red underline hover:text-red-700">重置所有分類與設定</button></div>
        </div>
    );
};