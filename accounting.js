const { useState, useEffect, useMemo, useCallback, useRef } = React;

const CategorySelector = ({ type, categoryGroups, selectedGroup, setSelectedGroup, onSelectCategory, currentCategory }) => {
    const effectiveType = type === 'advance' ? 'expense' : (type === 'repay' ? 'income' : type);
    if (!['expense', 'income'].includes(effectiveType)) return null;
    const groups = categoryGroups[effectiveType] || [];
    return (
        <div className="space-y-4 mt-6">
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar px-2 p-4">
                {groups.map(g => (
                    <button key={g.id} onClick={() => setSelectedGroup(g.id)} className={`flex flex-col items-center gap-1 min-w-[3rem] transition-all ${selectedGroup === g.id ? 'opacity-100 scale-110' : 'opacity-50 hover:opacity-80'}`}>
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${selectedGroup === g.id ? 'border-muji-accent text-white bg-muji-accent shadow-sm' : 'border-muji-muted text-muji-muted'}`}>
                            <i data-lucide={g.icon} className="w-5 h-5 stroke-[1.5]"></i>
                        </div>
                        <span className="text-[10px] text-muji-text font-bold mt-1">{g.label}</span>
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
                {groups.find(g => g.id === selectedGroup)?.subs.map(sub => {
                    const catId = `${selectedGroup}_${sub}`;
                    const isSelected = currentCategory === catId;
                    return (
                        <button key={sub} onClick={() => onSelectCategory(catId)} className={`py-1.5 px-1 rounded text-xs border transition-colors truncate ${isSelected ? 'bg-muji-accent text-white border-muji-accent shadow-sm' : 'bg-muji-card border-muji-border text-muji-text hover:border-muji-accent'}`}>
                            {sub}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const ExtraFieldsInput = ({ type, accountId, toAccountId, targetName, userAccounts, selectedAccount, onChange, debtTargets, onAddTarget }) => {
    if (type === 'transfer') {
        const handleSwap = () => { if (onChange) onChange('swap_accounts', { from: accountId, to: toAccountId }); };
        return (
            <div className="flex gap-2 mt-1 w-full items-end">
                <div className="flex-1 flex flex-col gap-1"><label className="text-xs text-muji-muted">轉出 (From)</label><select className="p-2 bg-muji-card rounded border border-muji-border text-sm w-full text-muji-text" value={accountId} onChange={e => onChange('accountId', e.target.value)}><option value="">選擇帳戶</option>{userAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div className="flex items-center pb-2 text-muji-muted"><button onClick={handleSwap} className="p-1 hover:bg-muji-bg rounded-full transition-colors"><i data-lucide="arrow-right-left" className="w-4 h-4"></i></button></div>
                <div className="flex-1 flex flex-col gap-1"><label className="text-xs text-muji-muted">轉入 (To)</label><select className="p-2 bg-muji-card rounded border border-muji-border text-sm w-full text-muji-text" value={toAccountId} onChange={e => onChange('toAccountId', e.target.value)}><option value="">選擇帳戶</option>{userAccounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            </div>
        );
    }
    if (type === 'advance' || type === 'repay') {
        return (
            <div className="flex flex-col gap-1 mt-2">
                <label className="text-xs text-muji-muted font-bold">{type === 'advance' ? '代墊對象' : '還款來源 (對象)'}</label>
                <div className="flex gap-2">
                     <select className="flex-1 p-2 bg-muji-card rounded border border-muji-border text-sm text-muji-text" value={targetName} onChange={e => onChange('targetName', e.target.value)}>
                        <option value="">選擇對象...</option>
                        {debtTargets.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                     </select>
                     <button onClick={() => { const name = prompt("新增對象:"); if(name) onAddTarget(name); }} className="p-2 bg-muji-bg border border-muji-border rounded text-xs"><i data-lucide="plus" className="w-4 h-4"></i></button>
                </div>
            </div>
        );
    }
    return null;
};

const SplitSection = ({ amount, splits, setSplits, debtTargets, onAddTarget, flatCategories, isWithOthersMode, categoryGroups, type }) => {
    const totalAmount = parseFloat(amount) || 0;
    const safeSplits = Array.isArray(splits) ? splits : [];
    const [selectingCategoryIdx, setSelectingCategoryIdx] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState('food'); 

    useEffect(() => {
        const defGroup = type === 'income' ? 'active' : 'food';
        setSelectedGroup(defGroup);
    }, [type]);

    useEffect(() => {
        if (safeSplits.length === 0 && totalAmount > 0) {
            const defCat = type === 'income' ? 'active_薪資' : 'food_三餐';
            setSplits([{ owner: 'me', name: '我', amount: totalAmount, percent: '', categoryId: Object.keys(flatCategories)[0] || defCat, type: type }]);
        }
    }, [totalAmount, type]); 

    const splitTotal = safeSplits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    const isValid = Math.abs(totalAmount - splitTotal) < 1;

    const addSplit = () => {
        const defCat = type === 'income' ? 'active_薪資' : 'food_三餐';
        const newSplit = { owner: 'me', name: '我', amount: 0, percent: '', categoryId: safeSplits[0]?.categoryId || defCat, type: type };
        setSplits([...safeSplits, newSplit]);
    };
    
    const updateSplit = (idx, field, val) => {
        let newSplits = [...safeSplits];
        let newSplit = { ...newSplits[idx], [field]: val };
        if(field === 'owner') {
            if (val === 'me') { newSplit.name = '我'; newSplit.percent = ''; newSplit.type = type; } 
            else if (val === '__add_new__') { const newT = prompt("輸入新對象姓名"); if (newT) { onAddTarget(newT); newSplit.owner = newT; newSplit.name = newT; } else return; } 
            else {
                newSplit.name = val;
                if (type === 'expense') newSplit.type = 'advance'; else if (type === 'income') newSplit.type = 'repay';
                const targetObj = debtTargets.find(t => t.name === val);
                if (targetObj && targetObj.defaultPercent) { const pct = parseFloat(targetObj.defaultPercent); newSplit.percent = pct; newSplit.amount = Math.round(totalAmount * (pct / 100)); }
            }
        } else if (field === 'percent') { 
            const pct = parseFloat(val); if (!isNaN(pct)) { newSplit.amount = Math.round(totalAmount * (pct / 100)); } else { newSplit.percent = ''; }
        } else if (field === 'amount') { newSplit.percent = ''; } else if (field === 'type') { newSplit.type = val; }
        newSplits[idx] = newSplit;
        const mainMeIndex = newSplits.findIndex(s => s.owner === 'me');
        if (mainMeIndex !== -1 && idx !== mainMeIndex) {
            const otherSum = newSplits.reduce((sum, s, i) => i === mainMeIndex ? sum : sum + (parseFloat(s.amount) || 0), 0);
            const residual = totalAmount - otherSum;
            if (residual >= 0) newSplits[mainMeIndex] = { ...newSplits[mainMeIndex], amount: residual, percent: '' };
        }
        setSplits(newSplits);
    };
    
    const removeSplit = (idx) => {
        let newSplits = safeSplits.filter((_, i) => i !== idx);
        const mainMeIndex = newSplits.findIndex(s => s.owner === 'me');
        if (mainMeIndex !== -1) {
             const otherSum = newSplits.reduce((sum, s, i) => i === mainMeIndex ? sum : sum + (parseFloat(s.amount) || 0), 0);
             newSplits[mainMeIndex] = { ...newSplits[mainMeIndex], amount: totalAmount - otherSum };
        }
        setSplits(newSplits);
    };

    return (
        <div className="mt-4 p-3 bg-muji-bg rounded-lg border border-muji-border text-sm animate-fade">
            <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-muji-text">{type === 'income' ? '多類別明細' : '分帳 / 多類別明細'}</span>
                <span className={`text-xs font-mono ${isValid ? 'text-muji-green' : 'text-muji-red'}`}>合計: ${splitTotal.toLocaleString()} {isValid ? 'OK' : `(差 ${totalAmount - splitTotal})`}</span>
            </div>
            <div className="space-y-2">
                {safeSplits.map((s, idx) => {
                    const cat = flatCategories[s.categoryId] || {};
                    const rowTypeOptions = type === 'expense' ? [{val: 'expense', label: '支出'}, {val: 'advance', label: '代墊'}] : [{val: 'income', label: '收入'}, {val: 'repay', label: '還款'}];
                    return (
                        <div key={idx} className="flex flex-col gap-1 p-2 bg-white rounded border border-muji-border shadow-sm">
                            <div className="flex gap-2">
                                <select className="w-1/4 p-1.5 bg-muji-bg rounded border border-muji-border text-xs text-muji-text font-bold" value={s.owner === 'me' ? 'me' : s.name} onChange={e => updateSplit(idx, 'owner', e.target.value)}>
                                    <option value="me">我</option>
                                    <optgroup label="對象">{debtTargets.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</optgroup>
                                    <option value="__add_new__">+ 新增...</option>
                                </select>
                                <select className={`w-1/4 p-1.5 rounded border border-muji-border text-xs font-bold ${s.type === 'advance' ? 'bg-orange-50 text-orange-600' : 'bg-muji-bg text-muji-text'}`} value={s.type || type} onChange={e => updateSplit(idx, 'type', e.target.value)} disabled={s.owner === 'me'}> 
                                     {rowTypeOptions.map(opt => <option key={opt.val} value={opt.val}>{opt.label}</option>)}
                                </select>
                                <button className="flex-1 p-1.5 bg-muji-bg rounded border border-muji-border text-xs text-muji-text flex items-center justify-between" onClick={() => { setSelectingCategoryIdx(idx); if (cat.group) { let foundGroupId = 'food'; for(let type in categoryGroups) { for(let g of categoryGroups[type]) { if(g.label === cat.group) { foundGroupId = g.id; break; } } } setSelectedGroup(foundGroupId); } else { setSelectedGroup(type === 'income' ? 'active' : 'food'); } }}>
                                    <span className="flex items-center gap-1">
                                        {cat.icon && <span className="flex"><i data-lucide={cat.icon} className="w-3 h-3"></i></span>}
                                        {cat.name || '選擇分類'}
                                    </span>
                                    <span className="flex"><i data-lucide="chevron-down" className="w-3 h-3 text-muji-muted"></i></span>
                                </button>
                            </div>
                            <div className="flex gap-2 items-center">
                                <div className="relative w-20"><input type="number" className="w-full p-1.5 pl-1 pr-4 bg-white rounded border border-muji-border text-xs text-center text-muji-text font-mono" placeholder="%" value={s.percent || ''} onChange={e => updateSplit(idx, 'percent', e.target.value)} /><span className="absolute right-1.5 top-1.5 text-xs text-muji-muted">%</span></div>
                                <div className="relative flex-1"><span className="absolute left-2 top-1.5 text-xs text-muji-muted">$</span><input type="number" className="w-full p-1.5 pl-4 bg-white rounded border border-muji-border text-xs text-muji-text font-mono font-bold" placeholder="金額" value={s.amount} onChange={e => updateSplit(idx, 'amount', e.target.value)} /></div>
                                <button onClick={() => removeSplit(idx)} className="p-1.5 text-muji-muted hover:text-muji-red hover:bg-muji-bg rounded transition-colors"><i data-lucide="trash-2" className="w-4 h-4"></i></button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <button onClick={addSplit} className="w-full py-2 border border-dashed border-muji-accent text-muji-accent text-xs rounded hover:bg-white transition-colors flex items-center justify-center gap-1 mt-3"><i data-lucide="plus" className="w-3 h-3"></i> 新增明細</button>
            {selectingCategoryIdx !== null && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop" onClick={() => setSelectingCategoryIdx(null)}>
                    <div className="bg-muji-card w-full max-w-sm rounded-xl shadow-2xl overflow-hidden border border-muji-border flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-muji-border flex justify-between items-center bg-muji-bg"><h3 className="font-bold text-lg text-muji-text">選擇分類</h3><button onClick={() => setSelectingCategoryIdx(null)} className="p-2 hover:bg-black/5 rounded-full"><i data-lucide="x" className="w-5 h-5 text-muji-muted"></i></button></div>
                        <div className="p-4 overflow-y-auto custom-scrollbar"><CategorySelector type={type === 'income' ? 'income' : 'expense'} categoryGroups={categoryGroups} selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup} onSelectCategory={(catId) => { updateSplit(selectingCategoryIdx, 'categoryId', catId); setSelectingCategoryIdx(null); }} currentCategory={safeSplits[selectingCategoryIdx]?.categoryId} /></div>
                    </div>
                </div>
            )}
        </div>
    );
};

window.SmartImportModal = ({ onClose, importText, setImportText, previewData, setPreviewData, saveData, data, handleSmartImport, flatCategories, userAccounts, selectedAccount }) => {
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [editingPreviewIndex, setEditingPreviewIndex] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState('food');
    const [targetAccountId, setTargetAccountId] = useState(selectedAccount || (userAccounts.length > 0 ? userAccounts[0].id : ''));
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    useEffect(() => { window.refreshIcons(); }, [showCategoryPicker, previewData]);
    const doSmartImport = () => { handleSmartImport(targetAccountId); };
    const handleAttemptClose = (reason) => { if (reason === 'close_btn') onClose(); else if (previewData.length > 0 || importText.trim().length > 0) setShowExitConfirm(true); else onClose(); };
    const confirmClose = () => { setShowExitConfirm(false); onClose(); };
    return (
        <window.Modal title="AI 記帳" onClose={handleAttemptClose}>
            {previewData.length === 0 ? (
                <div className="space-y-4">
                    <div className="flex flex-col gap-1"><label className="text-xs text-muji-muted font-bold">匯入至帳戶</label><select className="w-full p-2 bg-muji-card rounded border border-muji-border text-sm text-muji-text" value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)}>{userAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}</select></div>
                    <textarea className="w-full h-40 p-3 bg-white rounded-lg text-sm border border-muji-border focus:border-muji-accent outline-none text-muji-text" placeholder="直接貼上..." value={importText} onChange={e => setImportText(e.target.value)}></textarea>
                    <button onClick={doSmartImport} className="w-full py-3 bg-muji-accent text-white rounded-lg font-bold shadow-sm">解析</button>
                </div>
            ) : (
                 <div className="space-y-4">
                    {!showCategoryPicker ? (
                        <>
                            <div className="max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar pr-1">{previewData.map((item, idx) => (<div key={item.id || idx} className="flex flex-col gap-2 p-3 bg-muji-card rounded-lg text-sm border border-muji-border shadow-sm"><div className="flex justify-between items-center gap-2"><input type="date" className="bg-transparent border-b border-muji-border focus:border-muji-accent outline-none font-mono text-muji-text w-28 text-xs" value={item.date} onChange={(e) => { const n = [...previewData]; n[idx].date = e.target.value; setPreviewData(n); }} /><select className="bg-transparent font-bold outline-none cursor-pointer text-xs flex-1" value={item.type} onChange={(e) => { const n = [...previewData]; n[idx].type = e.target.value; setPreviewData(n); }}>{Object.entries(window.TX_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select><input type="number" className="bg-transparent font-bold font-mono outline-none w-20 text-right border-b border-muji-border focus:border-muji-accent text-muji-text" value={item.amount} onChange={(e) => { const n = [...previewData]; n[idx].amount = parseFloat(e.target.value); setPreviewData(n); }} /><button onClick={() => setPreviewData(previewData.filter((_, i) => i !== idx))} className="text-muji-muted hover:text-muji-red"><i data-lucide="trash-2" className="w-4 h-4"></i></button></div><div className="flex items-center gap-2">{(item.type === 'expense' || item.type === 'income') && (<button onClick={() => { setEditingPreviewIndex(idx); setShowCategoryPicker(true); }} className="flex-1 text-left px-2 py-1.5 rounded bg-white border border-muji-border text-xs flex items-center gap-2 hover:border-muji-accent text-muji-text"><i data-lucide={flatCategories[item.categoryId]?.icon || 'tag'} className="w-3 h-3"></i>{flatCategories[item.categoryId]?.name || '選擇分類'}</button>)}<ExtraFieldsInput type={item.type} accountId={item.accountId} toAccountId={item.toAccountId} targetName={item.targetName} userAccounts={userAccounts} selectedAccount={item.accountId} onChange={(k, v) => { const n = [...previewData]; n[idx][k] = v; setPreviewData(n); }} debtTargets={data.debtTargets} onAddTarget={() => {}} /></div><input type="text" className="w-full bg-transparent border-b border-muji-border focus:border-muji-accent outline-none text-muji-text text-xs placeholder-muji-muted" placeholder="備註..." value={item.note} onChange={(e) => { const n = [...previewData]; n[idx].note = e.target.value; setPreviewData(n); }} /></div>))}</div>
                            <div className="flex gap-2 pt-2"><button onClick={() => setPreviewData([])} className="flex-1 py-3 bg-white text-muji-text rounded-lg font-bold border border-muji-border">放棄</button><button onClick={() => { saveData({...data, transactions: [...data.transactions, ...previewData], debtTargets: data.debtTargets }); setPreviewData([]); onClose(); }} className="flex-[2] py-3 bg-muji-accent text-white rounded-lg font-bold shadow-sm">確認匯入 ({previewData.length})</button></div>
                        </>
                    ) : (
                        <div className="animate-fade"><div className="flex justify-between items-center mb-4"><h4 className="font-bold text-muji-text">選擇分類</h4><button onClick={() => setShowCategoryPicker(false)} className="text-muji-muted">取消</button></div><CategorySelector type={previewData[editingPreviewIndex].type} categoryGroups={window.DEFAULT_CATEGORY_GROUPS} selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup} onSelectCategory={(catId) => { const n = [...previewData]; n[editingPreviewIndex].categoryId = catId; setPreviewData(n); setShowCategoryPicker(false); }} /></div>
                    )}
                </div>
            )}
            {showExitConfirm && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-pop cursor-auto" onClick={(e) => e.stopPropagation()}><div className="bg-white p-6 rounded-xl shadow-xl border border-muji-border w-full max-w-sm"><h4 className="font-bold text-lg mb-2 text-muji-text">確認中斷</h4><p className="text-sm text-muji-muted mb-4">內容尚未儲存，確定要中斷記帳嗎？</p><div className="flex gap-3"><button onClick={() => setShowExitConfirm(false)} className="flex-1 py-2 rounded-lg border border-muji-border text-muji-muted hover:bg-muji-bg">繼續編輯</button><button onClick={confirmClose} className="flex-1 py-2 rounded-lg bg-muji-red text-white font-bold shadow-sm">確定中斷</button></div></div></div>)}
        </window.Modal>
    );
};

window.TransactionModal = ({ onClose, isEditMode, newTx, setNewTx, isSplitMode, setIsSplitMode, splitTotal, setSplitTotal, splits, setSplits, categoryGroups, flatCategories, userAccounts, selectedAccount, saveTransaction, handleDeleteTransaction, data, saveData, showToast }) => {
    const [selectedGroup, setSelectedGroup] = useState(flatCategories[newTx.categoryId]?.group || (newTx.type === 'income' ? 'active' : 'food'));
    const [showBalanceConfirm, setShowBalanceConfirm] = useState(false);
    const [pendingBalanceDiff, setPendingBalanceDiff] = useState(0);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const debtTargets = data.debtTargets || [];
    
    useEffect(() => { window.refreshIcons(); }, [newTx.type, selectedGroup, isSplitMode]);

    const handleAddTarget = (name) => {
        if (!name) return;
        const currentTargets = data.debtTargets || [];
        if (currentTargets.some(t => t.name === name)) return;
        const newTargets = [...currentTargets, { id: `dt_${Date.now()}`, name, defaultPercent: '' }];
        saveData({ ...data, debtTargets: newTargets }, false); 
    };

    const handleSave = () => { 
        // 修正：計算最終的 accountId，確保資料能被正確寫入到指定帳戶
        const finalAccountId = newTx.accountId || selectedAccount || (userAccounts.length > 0 ? userAccounts[0].id : '');

        if (!finalAccountId && newTx.type !== 'transfer') {
             if(showToast) showToast('請選擇帳戶', 'error');
             return;
        }

        if ((newTx.type === 'expense' || newTx.type === 'income') && isSplitMode) {
             const safeSplits = (splits || []).filter(s => s.name && parseFloat(s.amount) > 0);
             const total = parseFloat(splitTotal || 0);
             const splitSum = safeSplits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
             const diff = total - splitSum;
             
             if (diff > 1) {
                 setPendingBalanceDiff(diff);
                 setShowBalanceConfirm(true);
                 return;
             } else if (diff < -1) {
                 if(showToast) showToast('分帳金額超過總金額', 'error');
                 return;
             }

             const linkId = Date.now().toString(); 
             const txsToSave = safeSplits.map((s, idx) => {
                const isMe = s.owner === 'me';
                let txType = s.type || newTx.type; 
                let targetName = '';
                
                if (!isMe) {
                    targetName = s.name;
                    if (!s.type) {
                        if (newTx.type === 'expense') txType = 'advance'; 
                        else if (newTx.type === 'income') txType = 'repay';
                    }
                }

                return {
                    id: linkId + '_' + idx, 
                    linkId: linkId, 
                    date: newTx.date,
                    type: txType,
                    accountId: finalAccountId, 
                    toAccountId: '', 
                    amount: parseFloat(s.amount),
                    note: newTx.note + (s.note ? ` (${s.note})` : ''), 
                    categoryId: s.categoryId,
                    targetName: targetName,
                    splits: [] 
                };
             });

             saveTransaction(txsToSave, data.debtTargets); 

        } else {
             const txToSave = { 
                 ...newTx, 
                 id: newTx.id || Date.now().toString(),
                 amount: parseFloat(newTx.amount),
                 accountId: finalAccountId,
                 splits: [] 
             };
             saveTransaction(txToSave, data.debtTargets); 
        }
    };

    const handleUpdateField = (key, value) => {
        if (key === 'swap_accounts') {
             setNewTx({ ...newTx, accountId: value.to, toAccountId: value.from });
        } else {
             setNewTx({...newTx, [key]: value});
        }
    };

    const handleConfirmBalance = () => {
        const safeSplits = (splits || []).filter(s => s.name && parseFloat(s.amount) > 0);
        const defCat = newTx.type === 'income' ? 'active_薪資' : 'food_三餐';
        safeSplits.push({
             owner: 'me',
             name: '我',
             amount: pendingBalanceDiff,
             percent: '',
             categoryId: newTx.categoryId || defCat,
             type: newTx.type
        });
        
        const linkId = Date.now().toString();
        const finalAccountId = newTx.accountId || selectedAccount || (userAccounts.length > 0 ? userAccounts[0].id : '');

        const txsToSave = safeSplits.map((s, idx) => {
            const isMe = s.owner === 'me';
            let txType = s.type || newTx.type;
            let targetName = '';
            
            if (!isMe) {
                targetName = s.name;
                if(!s.type) txType = newTx.type === 'expense' ? 'advance' : 'repay';
            }

            return {
                id: linkId + '_' + idx,
                linkId: linkId,
                date: newTx.date,
                type: txType,
                accountId: finalAccountId,
                amount: parseFloat(s.amount),
                note: newTx.note,
                categoryId: s.categoryId,
                targetName: targetName,
                splits: []
            };
        });

        saveTransaction(txsToSave, data.debtTargets);
        setShowBalanceConfirm(false);
    };

    const toggleSplitMode = () => {
         const nextMode = !isSplitMode;
         setIsSplitMode(nextMode);

         if (nextMode) {
             setSplitTotal(newTx.amount.toString() || '0');
             if ((newTx.splits || []).length === 0) {
                 const defCat = newTx.type === 'income' ? 'active_薪資' : 'food_三餐';
                 setSplits([{ 
                     owner: 'me', 
                     name: '我', 
                     amount: newTx.amount || '', 
                     percent: '', 
                     categoryId: newTx.categoryId || 'food_伙食' 
                 }]);
             } else {
                 setSplits(newTx.splits);
             }
         } else {
             setSplitTotal('');
             setSplits([]);
         }
    }

    const handleAttemptClose = (reason) => {
        if (reason === 'close_btn') {
            onClose();
        } else {
            setShowExitConfirm(true);
        }
    };

    const confirmClose = () => {
        setShowExitConfirm(false);
        onClose();
    };
    
    return (
        <window.Modal title={isEditMode ? "編輯交易" : "記一筆"} onClose={handleAttemptClose}>
            <div className="space-y-4">
                <div className="flex justify-between items-center overflow-x-auto no-scrollbar pb-2">
                    <div className="flex bg-muji-bg rounded-lg p-1">
                        {Object.entries(window.TX_TYPES).map(([k, v]) => {
                            if (newTx.isQuickAdd && k !== 'expense') return null;
                            const isDisabled = isSplitMode && k !== newTx.type && k !== 'expense' && k !== 'income'; 
                            
                            return (
                                <button 
                                    key={k} 
                                    disabled={isDisabled} 
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition whitespace-nowrap ${newTx.type === k ? 'bg-muji-card shadow-sm text-muji-accent border border-muji-border' : 'text-muji-muted'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                    onClick={() => { 
                                        let defCat = 'food_三餐'; 
                                        let defGroup = 'food'; 
                                        if(k === 'income') { defCat = 'active_薪資'; defGroup = 'active'; }
                                        setNewTx({...newTx, type: k, categoryId: defCat}); 
                                        setSelectedGroup(defGroup); 
                                        if(isSplitMode) {
                                            setSplits([{ 
                                                owner: 'me', name: '我', amount: splitTotal, percent: '', categoryId: defCat, type: k 
                                            }]);
                                        }
                                    }}
                                >
                                    {v.label}
                                </button>
                            );
                        })}
                    </div>
                    
                    {['expense', 'income'].includes(newTx.type) && !newTx.isQuickAdd && (
                        <div className="flex items-center gap-2 ml-2">
                            <span className="text-xs text-muji-text font-bold whitespace-nowrap">拆帳/代墊</span>
                            <button onClick={toggleSplitMode} className={`w-8 h-5 rounded-full p-0.5 transition-colors flex-shrink-0 ${isSplitMode ? 'bg-muji-accent' : 'bg-muji-border'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isSplitMode ? 'translate-x-3' : ''}`}></div>
                            </button>
                        </div>
                    )}
                </div>

                <input type="number" 
                    className="w-full text-4xl font-bold text-center py-4 bg-transparent border-b border-muji-border outline-none font-mono text-muji-text" 
                    placeholder={isSplitMode ? "總金額" : "0"} 
                    autoFocus={!isSplitMode} 
                    value={isSplitMode ? splitTotal : newTx.amount} 
                    onChange={e => isSplitMode ? setSplitTotal(e.target.value) : setNewTx({...newTx, amount: e.target.value})} 
                />
                
                {['expense', 'income'].includes(newTx.type) && isSplitMode ? (
                    <SplitSection 
                        amount={splitTotal} 
                        splits={splits} 
                        setSplits={setSplits} 
                        debtTargets={debtTargets} 
                        flatCategories={flatCategories}
                        isWithOthersMode={true} 
                        onAddTarget={handleAddTarget}
                        categoryGroups={categoryGroups}
                        type={newTx.type}
                    />
                ) : (
                    <>
                        <CategorySelector 
                            type={newTx.type} 
                            categoryGroups={categoryGroups} 
                            selectedGroup={selectedGroup} 
                            setSelectedGroup={setSelectedGroup} 
                            onSelectCategory={(catId) => setNewTx({...newTx, categoryId: catId})} 
                            currentCategory={newTx.categoryId} 
                        />
                        <ExtraFieldsInput 
                            type={newTx.type} 
                            accountId={newTx.accountId}
                            toAccountId={newTx.toAccountId} 
                            targetName={newTx.targetName} 
                            userAccounts={userAccounts} 
                            selectedAccount={selectedAccount} 
                            onChange={handleUpdateField} 
                            debtTargets={debtTargets} 
                            onAddTarget={() => {}} 
                        />
                         {/* Show account selector if not transfer (transfer handles its own) AND no selectedAccount (e.g. global add) */}
                        {newTx.type !== 'transfer' && !selectedAccount && (
                             <div className="flex flex-col gap-1 mt-2">
                                <label className="text-xs text-muji-muted font-bold">帳戶</label>
                                <select 
                                    className="p-2 bg-muji-card rounded border border-muji-border text-sm w-full text-muji-text" 
                                    value={newTx.accountId} 
                                    onChange={e => setNewTx({...newTx, accountId: e.target.value})}
                                >
                                    <option value="">選擇帳戶</option>
                                    {userAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        )}
                    </>
                )}
                
                <div className="flex gap-2 mt-4">
                    <input type="date" className="flex-1 p-3 bg-muji-card rounded-lg text-muji-text border border-muji-border" value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} />
                    <input type="text" className="flex-[2] p-3 bg-muji-card rounded-lg text-muji-text border border-muji-border" placeholder="備註" value={newTx.note} onChange={e => setNewTx({...newTx, note: e.target.value})} />
                </div>
                
                {newTx.isQuickAdd && (
                    <div className="text-xs text-muji-muted text-center mt-1">
                        (快速記帳模式：已鎖定為現金支出)
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    {isEditMode && <button onClick={handleDeleteTransaction} className="flex-1 py-3 bg-muji-red/10 text-muji-red rounded-lg font-bold border border-muji-red/30">刪除</button>}
                    <button onClick={handleSave} className="flex-[2] py-3 bg-muji-accent text-white rounded-lg font-bold shadow-sm">{isEditMode ? "更新" : "儲存"}</button>
                </div>
            </div>

            {/* Custom Confirm Modal for Balance */}
            {showBalanceConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-pop">
                    <div className="bg-white p-6 rounded-xl shadow-xl border border-muji-border w-full max-w-sm">
                        <h4 className="font-bold text-lg mb-2 text-muji-text">確認餘額分配</h4>
                        <p className="text-sm text-muji-muted mb-4">
                            尚有餘額 <span className="font-bold text-muji-text">${pendingBalanceDiff.toLocaleString()}</span> 未分配。<br/>
                            是否自動歸入「我」的支出？
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowBalanceConfirm(false)} className="flex-1 py-2 rounded-lg border border-muji-border text-muji-muted hover:bg-muji-bg">手動調整</button>
                            <button onClick={handleConfirmBalance} className="flex-1 py-2 rounded-lg bg-muji-accent text-white font-bold shadow-sm">是，自動歸入</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Confirm Modal for Exit */}
            {showExitConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-pop cursor-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white p-6 rounded-xl shadow-xl border border-muji-border w-full max-w-sm">
                        <h4 className="font-bold text-lg mb-2 text-muji-text">確認中斷</h4>
                        <p className="text-sm text-muji-muted mb-4">內容尚未儲存，確定要中斷記帳嗎？</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowExitConfirm(false)} className="flex-1 py-2 rounded-lg border border-muji-border text-muji-muted hover:bg-muji-bg">繼續編輯</button>
                            <button onClick={confirmClose} className="flex-1 py-2 rounded-lg bg-muji-red text-white font-bold shadow-sm">確定中斷</button>
                        </div>
                    </div>
                </div>
            )}
        </window.Modal>
    );
};

window.AccountingView = ({ data, saveData, selectedAccount, setSelectedAccount, setInputModal, showToast }) => {
    // 1. State
    const [showImport, setShowImport] = useState(false); const [importText, setImportText] = useState(''); const [previewData, setPreviewData] = useState([]);
    const [showAdd, setShowAdd] = useState(false); const [isEditMode, setIsEditMode] = useState(false); const [editingTxId, setEditingTxId] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date()); const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSplitMode, setIsSplitMode] = useState(false); const [splitTotal, setSplitTotal] = useState(''); const [splits, setSplits] = useState([]);
    const [newTx, setNewTx] = useState({ amount: '', note: '', type: 'expense', categoryId: 'food_伙食', date: new Date().toISOString().split('T')[0], toAccountId: '', targetName: '', splits: [] });
    // NEW: Filter Type State
    const [filterType, setFilterType] = useState('all'); 
    
    // NEW: Active Tab State for Account List
    const [activeTab, setActiveTab] = useState('expense_list'); // 'expense_list' | 'all_grid'

    // Multi-selection state
    const [selectedTxIds, setSelectedTxIds] = useState([]);
    const [showDeleteBatchConfirm, setShowDeleteBatchConfirm] = useState(false);
    const [expandedTypes, setExpandedTypes] = useState(['recent']); 
    const [expandedGroups, setExpandedGroups] = useState({});

    // 2. Constants & Memos
    const categoryGroups = data.settings?.categoryGroups || window.DEFAULT_CATEGORY_GROUPS;
    const accountTypes = data.settings?.accountTypes || window.DEFAULT_ACCOUNT_TYPES;
    const flatCategories = useMemo(() => window.getFlatCategories(categoryGroups), [categoryGroups]);
    
    // User Accounts
    const userAccounts = data.accounts.filter(a => a.userId === data.currentUser || (!a.userId && data.currentUser === 'default'));

    // NEW: Calculate Last Modified Date for all accounts to sort them
    const accountLastModified = useMemo(() => {
        const map = {};
        // Initialize with 0 for all current user accounts
        userAccounts.forEach(a => map[a.id] = 0);
        
        data.transactions.forEach(t => {
            // Only consider if transaction is relevant to current user accounts
            const time = new Date(t.date).getTime();
            if (map.hasOwnProperty(t.accountId)) {
                if (time > map[t.accountId]) map[t.accountId] = Math.max(map[t.accountId], time);
            }
            if (t.toAccountId && map.hasOwnProperty(t.toAccountId)) {
                if (time > map[t.toAccountId]) map[t.toAccountId] = Math.max(map[t.toAccountId], time);
            }
        });
        return map;
    }, [data.transactions, userAccounts]);

    // NEW: Calculate Monthly Expense for all accounts (Current Calendar Month)
    const accountMonthlyExpenses = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        const expenses = {};
        
        data.transactions.forEach(t => {
            const d = new Date(t.date);
            if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
                if (t.type === 'expense' && t.accountId) {
                    let amount = t.amount || 0;
                    // Deduct splits for others
                    if (t.splits && t.splits.length > 0) {
                        const othersAmount = t.splits.reduce((acc, s) => {
                            return s.owner !== 'me' ? acc + (parseFloat(s.amount) || 0) : acc;
                        }, 0);
                        amount -= othersAmount;
                    }
                    
                    if (amount > 0) {
                        expenses[t.accountId] = (expenses[t.accountId] || 0) + amount;
                    }
                }
            }
        });
        return expenses;
    }, [data.transactions]);
    
    // NEW: Prepare Accounts for Monthly Expense List Tab
    const monthlyExpenseAccounts = useMemo(() => {
        const list = userAccounts.filter(acc => (accountMonthlyExpenses[acc.id] || 0) > 0);
        // Sort by expense amount descending
        return list.sort((a, b) => (accountMonthlyExpenses[b.id] || 0) - (accountMonthlyExpenses[a.id] || 0));
    }, [userAccounts, accountMonthlyExpenses]);

    const totalMonthlyExpenseSum = useMemo(() => {
        return monthlyExpenseAccounts.reduce((sum, acc) => sum + (accountMonthlyExpenses[acc.id] || 0), 0);
    }, [monthlyExpenseAccounts, accountMonthlyExpenses]);


    // 3. Helper Functions - DEFINED AT TOP LEVEL
    const resetForm = () => { setNewTx({ amount: '', note: '', type: 'expense', categoryId: 'food_伙食', date: new Date().toISOString().split('T')[0], toAccountId: '', targetName: '', splits: [] }); setIsSplitMode(false); setSplitTotal(''); setSplits([]); setIsEditMode(false); setEditingTxId(null); };

    // Define openEdit HERE, at the top level
    const openEdit = (tx) => { setNewTx({ ...tx, amount: tx.amount.toString(), accountId: tx.accountId || selectedAccount }); if(tx.splits && tx.splits.length > 0) { setIsSplitMode(true); setSplitTotal(tx.amount.toString()); setSplits(tx.splits); } else { setIsSplitMode(false); setSplitTotal(''); setSplits([]); } setIsEditMode(true); setEditingTxId(tx.id); setShowAdd(true); };

    // Updated: Sort by recency properly (Top 4)
    const getRecentAccounts = useCallback(() => {
        // Sort all user accounts by last modified date descending (using the memoized map)
        const sorted = [...userAccounts].sort((a, b) => {
            const timeA = accountLastModified[a.id] || 0;
            const timeB = accountLastModified[b.id] || 0;
            if (timeB === timeA) return 0; 
            return timeB - timeA;
        });
        
        // Return top 4
        return sorted.slice(0, 4);
    }, [userAccounts, accountLastModified]);

    const getFilteredTransactions = useCallback(() => { 
        const y = currentDate.getFullYear(); const m = currentDate.getMonth(); 
        let txs = data.transactions.filter(t => { 
            const d = new Date(t.date); 
            const isRelated = t.accountId === selectedAccount || t.toAccountId === selectedAccount; 
            return d.getFullYear() === y && d.getMonth() === m && isRelated; 
        });
        
        // NEW: Filter by Type
        if (filterType !== 'all') {
            txs = txs.filter(t => t.type === filterType);
        }

        return txs.sort((a, b) => { const dateDiff = new Date(b.date) - new Date(a.date); if (dateDiff !== 0) return dateDiff; if (b.id < a.id) return -1; if (b.id > a.id) return 1; return 0; }); 
    }, [data.transactions, currentDate, selectedAccount, filterType]);

    // Memoize filtered transactions to avoid "rawFilteredTxs is not defined" issues in render
    const filteredTxs = useMemo(() => {
        if (!selectedAccount) return [];
        return getFilteredTransactions();
    }, [selectedAccount, getFilteredTransactions]);

    // NEW: Calculate Monthly Stats STRICTLY according to requirements
    const currentMonthStats = useMemo(() => {
        if (!selectedAccount) return { income: 0, expense: 0 };
        const y = currentDate.getFullYear(); const m = currentDate.getMonth();
        // Get ALL transactions for this month/account, ignoring the type filter for the stats display
        const monthTxs = data.transactions.filter(t => {
            const d = new Date(t.date);
            const isRelated = t.accountId === selectedAccount || t.toAccountId === selectedAccount;
            return d.getFullYear() === y && d.getMonth() === m && isRelated;
        });

        let income = 0;
        let expense = 0;

        monthTxs.forEach(t => {
            // Rule 1: 收入只有收入被計入 (Exclude Repay, Transfer In)
            if (t.type === 'income') {
                income += (t.amount || 0);
            }

            // Rule 2: 支出只有支出被計入 (Exclude Advance, Transfer Out, and non-me Splits)
            if (t.type === 'expense') {
                let myAmount = t.amount || 0;
                // Check if splits exist
                if (t.splits && t.splits.length > 0) {
                    const othersAmount = t.splits.reduce((acc, s) => {
                        return s.owner !== 'me' ? acc + (parseFloat(s.amount) || 0) : acc;
                    }, 0);
                    myAmount = myAmount - othersAmount;
                }
                expense += myAmount;
            }
        });

        return { income, expense };
    }, [data.transactions, currentDate, selectedAccount]);


    // Grouping Logic
    const groupedTxs = []; // Removed useMemo wrapper to ensure fresh closures
    let skipIds = new Set();
    filteredTxs.forEach(tx => {
        if (skipIds.has(tx.id)) return;
        if (tx.linkId) {
            const groupParts = filteredTxs.filter(t => t.linkId === tx.linkId);
            if (groupParts.length > 1) {
                const totalAmount = groupParts.reduce((sum, t) => sum + t.amount, 0);
                const headerTx = { ...tx, id: 'group_' + tx.linkId, isGroupHeader: true, totalAmount: totalAmount, subTransactions: groupParts };
                groupedTxs.push(headerTx);
                groupParts.forEach(t => skipIds.add(t.id));
            } else { groupedTxs.push(tx); skipIds.add(tx.id); }
        } else { groupedTxs.push(tx); skipIds.add(tx.id); }
    });

    const handleDuplicateTx = (tx) => { const newTx = JSON.parse(JSON.stringify(tx)); newTx.id = Date.now().toString(); delete newTx.linkId; const newTransactions = [...data.transactions, newTx]; saveData({ ...data, transactions: newTransactions }); showToast('已複製並新增一筆交易'); };
    const handleSaveTransaction = (txsToSave, newDebtTargets) => {
        let updatedTransactions = [...data.transactions]; let updatedDebtTargets = data.debtTargets || []; if(newDebtTargets) updatedDebtTargets = newDebtTargets;
        const txsArray = Array.isArray(txsToSave) ? txsToSave : [txsToSave];
        if (isEditMode && editingTxId) { const oldTx = data.transactions.find(t => t.id === editingTxId); if(oldTx && oldTx.linkId) { updatedTransactions = updatedTransactions.filter(t => t.id !== editingTxId); } else { updatedTransactions = updatedTransactions.filter(t => t.id !== editingTxId); } }
        updatedTransactions = [...updatedTransactions, ...txsArray];
        saveData({ ...data, transactions: updatedTransactions, debtTargets: updatedDebtTargets });
        setShowAdd(false); resetForm();
    };
    const handleDelete = (txToDelete) => { 
        const targetId = txToDelete?.id || editingTxId; const tx = txToDelete || data.transactions.find(t => t.id === targetId);
        if (!tx) return;
        let updatedTransactions = [...data.transactions];
        if (tx.linkId) { const group = updatedTransactions.filter(t => t.linkId === tx.linkId && t.id !== tx.id); if (group.length > 0) { let mainTxIndex = group.findIndex(t => !t.targetName || t.targetName === '我'); if (mainTxIndex === -1) mainTxIndex = 0; const mainTx = group[mainTxIndex]; const newAmount = mainTx.amount + tx.amount; const mainTxGlobalIndex = updatedTransactions.findIndex(t => t.id === mainTx.id); if (mainTxGlobalIndex !== -1) { updatedTransactions[mainTxGlobalIndex] = { ...mainTx, amount: newAmount }; } updatedTransactions = updatedTransactions.filter(t => t.id !== tx.id); saveData({ ...data, transactions: updatedTransactions }); setShowAdd(false); showToast(`已刪除並將 $${tx.amount} 加回 ${mainTx.targetName || '我'}`); return; } }
        updatedTransactions = updatedTransactions.filter(t => t.id !== targetId); saveData({ ...data, transactions: updatedTransactions }); setShowAdd(false); 
    };
    const handleDeleteTransaction = () => handleDelete(null);
    
    // Fixed: Properly toggle the boolean value, handling undefined as true (default open)
    const toggleGroup = (linkId) => { 
        setExpandedGroups(prev => {
            // If undefined, it means default open (true). So we want to set it to false.
            // If defined, just toggle it.
            const isCurrentlyOpen = prev[linkId] !== undefined ? prev[linkId] : true;
            return { ...prev, [linkId]: !isCurrentlyOpen };
        }); 
    };
    
    // AI Import Handler
    const handleSmartImport = (targetAccountId, hintType) => { 
        const rawLines = importText.split('\n').map(l => l.trim()).filter(l => l); const parsed = []; const currentYear = new Date().getFullYear(); const parseNum = (str) => parseFloat(str.replace(/,/g, '')); const isNum = (str) => /^\d{1,3}(,\d{3})*(\.\d+)?$/.test(str); const dateRegexFull = /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/; const dateRegexShort = /^(\d{1,2})[\/\-\.](\d{1,2})/; let currentBlock = []; 
        const processBlock = (block) => { if (block.length === 0) return; try { const dateLine = block[0]; let dateMatch = dateLine.match(dateRegexFull); let dateStr = ""; 
            if (dateMatch) { 
                dateStr = dateMatch[0].replace(/[\/\.]/g, '-'); 
            } else { 
                dateMatch = dateLine.match(dateRegexShort); 
                if (dateMatch) { 
                    const m = dateMatch[1].padStart(2, '0'); const d = dateMatch[2].padStart(2, '0'); dateStr = `${currentYear}-${m}-${d}`; 
                } 
            } 
            if (!dateStr) return; 
            let amount = 0; let type = 'expense'; let foundAmount = false; for (let i = 0; i < block.length; i++) { let content = block[i].replace(/−/g, '-').replace(/\t/g, ' '); const tokens = content.split(/\s+/).filter(t => t.trim() !== ''); for (let j = 0; j < tokens.length; j++) { const token = tokens[j]; const nextToken = tokens[j+1]; if (token.includes('/') || token.includes(':')) continue; if (isNum(token)) { if (nextToken === '-') { amount = parseNum(token); type = 'expense'; foundAmount = true; break; } if (tokens.length === 1 && !foundAmount) { amount = parseNum(token); type = 'expense'; foundAmount = true; break; } if (!foundAmount && block.length === 1 && j === tokens.length - 1) { amount = parseNum(token); type = 'expense'; foundAmount = true; break; } } else if (token === '-') { if (isNum(nextToken)) { amount = parseNum(nextToken); type = 'income'; foundAmount = true; break; } } } if (foundAmount) break; } if (!foundAmount || amount === 0) return; let noteParts = []; block.forEach((line, i) => { let content = line.replace(/−/g, '-').replace(/\t/g, ' '); if (i === 0 && dateMatch) content = content.replace(dateMatch[0], ''); content = content.replace(/-/g, '').trim(); const tokens = content.split(/\s+/); const cleanTokens = tokens.filter(t => { if (isNum(t) && parseNum(t) === amount) return false; return true; }); content = cleanTokens.join(' '); if (content.trim()) noteParts.push(content.trim()); }); let note = noteParts.join(' '); if (note.includes('配息') || note.includes('轉入') || note.includes('存款息')) { type = 'income'; } let toAccountId = ''; if (block.some(l => l.includes('提款'))) { type = 'transfer'; const cashAcc = userAccounts.find(a => a.type === 'cash'); if(cashAcc) toAccountId = cashAcc.id; } if (!note) note = "一般消費"; const txObj = { id: '', date: dateStr, amount: amount, note: note, type: type, categoryId: window.autoTag(note), accountId: targetAccountId, toAccountId: toAccountId, targetName: '', splits: [] }; parsed.push(txObj); } catch(e) { console.error("Block parse error", e); } }; 
        for (let i = 0; i < rawLines.length; i++) { const line = rawLines[i]; const isDateStart = dateRegexFull.test(line) || (dateRegexShort.test(line) && line.length < 50 && (line.includes('/') || line.includes('-'))); if (isDateStart) { if (currentBlock.length > 0) processBlock(currentBlock); currentBlock = [line]; } else { currentBlock.push(line); } } if (currentBlock.length > 0) processBlock(currentBlock); const baseTime = Date.now(); parsed.forEach((p, i) => { p.id = (baseTime + (parsed.length - i)).toString(); }); setPreviewData(parsed); 
    }; 

    const toggleSelectTx = (id) => { if (selectedTxIds.includes(id)) setSelectedTxIds(selectedTxIds.filter(tid => tid !== id)); else setSelectedTxIds([...selectedTxIds, id]); };
    const toggleSelectAll = (filteredTxs) => { if (selectedTxIds.length === filteredTxs.length) setSelectedTxIds([]); else setSelectedTxIds(filteredTxs.map(t => t.id)); };
    const confirmBatchDelete = () => { if (selectedTxIds.length > 0) { const updated = data.transactions.filter(t => !selectedTxIds.includes(t.id)); saveData({ ...data, transactions: updated }); setSelectedTxIds([]); setShowDeleteBatchConfirm(false); showToast('已刪除選取項目'); } };
    const toggleSection = (key) => { if (expandedTypes.includes(key)) setExpandedTypes(expandedTypes.filter(k => k !== key)); else setExpandedTypes([...expandedTypes, key]); window.refreshIcons(); };
    
    // Drag Refs
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);
    const handleDragStart = (e, id) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); dragItem.current = id; e.target.style.opacity = '0.5'; };
    const handleDragEnd = (e) => { e.target.style.opacity = '1'; dragItem.current = null; dragOverItem.current = null; };
    const handleDragOver = (e, id) => { e.preventDefault(); dragOverItem.current = id; };
    const handleDrop = (e, targetId) => { e.preventDefault(); const sourceId = dragItem.current; if (!sourceId || sourceId === targetId) return; const currentOrder = data.accountOrder || userAccounts.map(a => a.id); const sourceIndex = currentOrder.indexOf(sourceId); const targetIndex = currentOrder.indexOf(targetId); if (sourceIndex === -1 || targetIndex === -1) return; const newOrder = [...currentOrder]; const [removed] = newOrder.splice(sourceIndex, 1); newOrder.splice(targetIndex, 0, removed); saveData({ ...data, accountOrder: newOrder }, false); };

    // 4. Balance Map Calculation
    const balanceMap = useMemo(() => { if (!selectedAccount) return {}; const acc = data.accounts.find(a => a.id === selectedAccount); const initial = acc?.balance || 0; const allTxs = data.transactions.filter(t => t.accountId === selectedAccount || t.toAccountId === selectedAccount).sort((a, b) => { const dateDiff = new Date(a.date) - new Date(b.date); if (dateDiff !== 0) return dateDiff; if (a.id < b.id) return -1; if (a.id > b.id) return 1; return 0; }); const map = {}; let currentBal = initial; allTxs.forEach(tx => { const amount = parseFloat(tx.amount) || 0; if (tx.type === 'income' || (tx.type === 'repay' && tx.accountId === selectedAccount)) { currentBal += amount; } else if (tx.type === 'expense' || (tx.type === 'advance' && tx.accountId === selectedAccount)) { let finalAmount = amount; if (tx.type === 'expense' && tx.splits && tx.splits.length > 0) { const otherSplitsSum = tx.splits.filter(s => s.owner !== 'me').reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0); finalAmount = amount - otherSplitsSum; } currentBal -= finalAmount; } else if (tx.type === 'transfer') { if (tx.toAccountId === selectedAccount) { currentBal += amount; } else if (tx.accountId === selectedAccount) { currentBal -= amount; } } map[tx.id] = currentBal; }); map['_final'] = currentBal; return map; }, [data.transactions, selectedAccount, data.accounts]);
    
    // Add missing monthsWithData variable
    const monthsWithData = useMemo(() => {
        if (!selectedAccount) return new Set();
        const currentYear = currentDate.getFullYear();
        const activeMonths = new Set();
        data.transactions.forEach(t => {
            if(!t.date) return;
            const parts = t.date.split('-');
            const ty = parseInt(parts[0]);
            const tm = parseInt(parts[1]);
            const isRelated = t.accountId === selectedAccount || t.toAccountId === selectedAccount;
            if (ty === currentYear && isRelated) {
                activeMonths.add(tm - 1); // 0-based month index for display logic
            }
        });
        return activeMonths;
    }, [data.transactions, currentDate, selectedAccount]);

    // Effects
    useEffect(() => { 
        if (window.lucide) { 
            setTimeout(() => window.lucide.createIcons(), 50); 
            setTimeout(() => window.lucide.createIcons(), 500); 
        } 
    }, [showAdd, isEditMode, showImport, previewData, showDatePicker, expandedTypes, selectedAccount, data.transactions, filterType, expandedGroups, activeTab]); // Added expandedGroups & activeTab

    // Render
    if (selectedAccount) {
        const currentAccount = data.accounts.find(a => a.id === selectedAccount);
        const currentTotalBalance = balanceMap['_final'] !== undefined ? balanceMap['_final'] : (currentAccount?.balance || 0);
        
        return (
            <div className="pb-24 md:pb-0 animate-fade flex flex-col h-full relative">
               <div className="flex flex-col md:flex-row justify-between items-center mb-4 px-4 md:px-0 pt-4 gap-3 relative">
                    <div className="flex items-center gap-4 w-full md:w-1/3">
                        <button onClick={() => setSelectedAccount(null)} className="md:hidden p-2 -ml-2 rounded-full hover:bg-black/5"><i data-lucide="arrow-left" className="w-5 h-5 text-muji-text"></i></button>
                        <div>
                            <h3 className="text-xl font-bold text-muji-text leading-tight">{currentAccount?.name}</h3>
                            <button onClick={() => setInputModal({ show: true, title: '餘額校正', value: currentTotalBalance.toString(), type: 'calibrate_account', data: currentAccount.id, extra: currentTotalBalance })} className={`text-sm font-mono font-bold mt-1 text-left hover:opacity-60 transition-opacity flex items-center gap-2 ${currentTotalBalance >= 0 ? 'text-muji-green' : 'text-rose-500'}`} title="點擊校正餘額">${currentTotalBalance.toLocaleString()} <i data-lucide="pencil" className="w-3 h-3 opacity-30"></i></button>
                        </div>
                    </div>
                    <div className="flex justify-center w-full md:w-1/3"><div className="flex items-center bg-white border border-muji-border rounded-lg px-1 py-1"><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-muji-bg rounded"><i data-lucide="chevron-left" className="w-4 h-4"></i></button><span className="text-sm font-bold mx-2 cursor-pointer whitespace-nowrap" onClick={() => setShowDatePicker(true)}>{currentDate.getFullYear()}/{currentDate.getMonth() + 1}</span><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-muji-bg rounded"><i data-lucide="chevron-right" className="w-4 h-4"></i></button><button onClick={() => setCurrentDate(new Date())} className="ml-2 px-3 py-1 bg-muji-bg border border-muji-border rounded text-xs font-bold hover:bg-muji-hover text-muji-text">今天</button></div></div>
                    <div className="flex justify-end items-center gap-4 w-full md:w-1/3">
                        <div className="text-xs text-rose-500 font-bold bg-rose-50/50 px-2 py-1 rounded border border-rose-100">
                            本月支出: ${currentMonthStats.expense.toLocaleString()}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { resetForm(); setShowAdd(true); }} className="bg-muji-accent text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1"><i data-lucide="plus" className="w-4 h-4"></i> 記帳</button><button onClick={() => { setImportText(''); setPreviewData([]); setShowImport(true); }} className="bg-white border border-muji-border text-muji-text px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm hover:bg-muji-bg flex items-center gap-1"><i data-lucide="sparkles" className="w-4 h-4"></i> AI</button>
                        </div>
                    </div>
               </div>

                {/* Filter Row Only */}
                <div className="px-4 md:px-0 mb-4">
                    <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
                        {[
                            { id: 'all', label: '全部' },
                            { id: 'expense', label: '支出' },
                            { id: 'income', label: '收入' },
                            { id: 'transfer', label: '轉帳' },
                            { id: 'repay', label: '還款' },
                            { id: 'advance', label: '代墊' }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setFilterType(type.id)}
                                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filterType === type.id ? 'bg-muji-text text-white border-muji-text' : 'bg-white text-muji-muted border-muji-border hover:bg-muji-bg'}`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

               {selectedTxIds.length > 0 && (<div className="mb-4 flex justify-between items-center bg-muji-red/10 p-2 rounded-lg border border-muji-red/30 mx-4 md:mx-0"><span className="text-xs text-muji-red font-bold ml-2">已選取 {selectedTxIds.length} 筆</span><button onClick={() => setShowDeleteBatchConfirm(true)} className="text-xs bg-muji-red text-white px-3 py-1.5 rounded font-bold hover:opacity-80">刪除</button></div>)}

               <div className="flex-1 overflow-y-auto bg-white mx-4 md:mx-0 mb-20 md:mb-0 rounded-xl border border-muji-border min-h-[50vh] max-h-[calc(100vh-250px)] relative flex flex-col">
                    <div className="bg-muji-bg text-muji-muted font-medium border-b border-muji-border flex text-sm shadow-sm z-20 sticky top-0 grid grid-cols-[5rem_6rem_4rem_7rem_6rem_6rem_1fr] items-center">
                        <div className="p-4 flex justify-center"><input type="checkbox" className="w-4 h-4 accent-muji-accent cursor-pointer" checked={filteredTxs.length > 0 && selectedTxIds.length === filteredTxs.length} onChange={() => toggleSelectAll(filteredTxs)} /></div>
                        <div className="p-4 text-center">日期</div>
                        <div className="p-4 text-center">類型</div>
                        <div className="p-4 text-center">分類</div>
                        <div className="p-4 text-right">金額</div>
                        <div className="p-4 text-right">餘額</div>
                        <div className="p-4 pl-4 text-left">備註</div>
                    </div>
                    <div>
                        {groupedTxs.length === 0 ? (<div className="p-10 text-center text-muji-muted">無紀錄</div>) : (
                            groupedTxs.map(tx => { 
                                if (tx.isGroupHeader) {
                                    const isExpanded = expandedGroups[tx.linkId] !== false; // Default Open
                                    const firstSubTx = tx.subTransactions[0];
                                    const date = firstSubTx.date;
                                    const totalAmt = tx.totalAmount;
                                    return (
                                        <React.Fragment key={tx.id}>
                                            <div onClick={() => toggleGroup(tx.linkId)} className="grid grid-cols-[5rem_6rem_4rem_7rem_6rem_6rem_1fr] items-center border-b border-muji-border/50 bg-gray-50/80 hover:bg-gray-100 font-bold cursor-pointer transition-colors text-sm">
                                                {/* FIXED: Wrapped icon in span to prevent React from removing modified DOM node */}
                                                <div className="p-4 flex justify-center">
                                                    <span key={isExpanded ? "exp" : "col"} className="flex items-center justify-center">
                                                        <i data-lucide={isExpanded ? "chevron-down" : "chevron-right"} className="w-4 h-4 text-muji-muted"></i>
                                                    </span>
                                                </div>
                                                <div className="p-4 text-center font-mono text-xs">{date}</div>
                                                <div className="p-4 text-center text-xs text-muji-muted">拆帳</div>
                                                <div className="p-4 text-center text-xs"><span className="bg-muji-accent/10 text-muji-accent px-2 py-0.5 rounded-full text-[10px]">{tx.subTransactions.length} 筆</span></div>
                                                <div className="p-4 text-right font-mono text-muji-text">${totalAmt.toLocaleString()}</div>
                                                <div className="p-4 text-right">-</div>
                                                <div className="p-4 pl-4 text-xs text-muji-muted italic">點擊展開/收合</div>
                                            </div>
                                            {isExpanded && tx.subTransactions.map(subTx => {
                                                const cat = flatCategories[subTx.categoryId] || { icon: 'help-circle', name: '未分類' };
                                                const txType = window.TX_TYPES[subTx.type] || { label: '未知', color: 'text-gray-500' };
                                                let display = cat.name;
                                                if(subTx.type === 'repay' || subTx.type === 'advance') {
                                                     const target = subTx.targetName || '-';
                                                     display = `${cat.name} (${target})`;
                                                }
                                                const textColorClass = subTx.type === 'expense' ? 'text-rose-500' : (subTx.type === 'income' ? 'text-emerald-500' : txType.color);
                                                let sign = subTx.type === 'expense' || subTx.type === 'advance' ? '-' : '+';
                                                const balance = balanceMap[subTx.id];
                                                const isSettled = subTx.isSettled; // NEW
                                                return (
                                                    <div key={subTx.id} onClick={() => openEdit(subTx)} className={`grid grid-cols-[5rem_6rem_4rem_7rem_6rem_6rem_1fr] items-center border-b border-muji-border/50 hover:bg-muji-hover transition-colors bg-white cursor-pointer text-sm ${isSettled ? 'opacity-50' : ''}`}>
                                                        <div className="p-4 flex justify-center gap-2 pl-6 border-l-4 border-muji-accent/20"><button onClick={(e) => { e.stopPropagation(); handleDuplicateTx(subTx); }} className="p-1 text-muji-muted hover:text-muji-accent"><i data-lucide="copy" className="w-3.5 h-3.5"></i></button><button onClick={(e) => { e.stopPropagation(); handleDelete(subTx); }} className="p-1 text-muji-muted hover:text-muji-red" title="刪除並回補"><i data-lucide="trash-2" className="w-3.5 h-3.5"></i></button></div>
                                                        <div className="p-4 text-center opacity-0">-</div> 
                                                        <div className={`p-4 text-center font-bold ${txType.color} text-xs px-1 whitespace-nowrap ${isSettled ? 'line-through decoration-muji-text/50' : ''}`}>{txType.label}</div>
                                                        <div className={`p-4 text-center text-xs gap-2 flex justify-center items-center ${isSettled ? 'line-through decoration-muji-text/50' : ''}`}>{(subTx.type==='expense'||subTx.type==='income')&&
                                                            <span className="flex">
                                                                <i data-lucide={cat.icon || 'circle'} className="w-3.5 h-3.5 opacity-70"></i>
                                                            </span>
                                                        }<span className="truncate">{display}</span></div>
                                                        <div className={`p-4 text-right font-mono font-bold ${textColorClass} text-xs ${isSettled ? 'line-through decoration-muji-text/50' : ''}`}>{sign}${subTx.amount.toLocaleString()}</div>
                                                        <div className={`p-4 text-right font-mono text-xs text-muji-muted`}>${balance?.toLocaleString()}</div>
                                                        <div className={`p-4 pl-4 text-left text-muji-muted text-xs truncate ${isSettled ? 'line-through' : ''}`}>{subTx.note}{isSettled ? ' (已結清)' : ''}</div>
                                                    </div>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                } else {
                                    const cat = flatCategories[tx.categoryId] || { icon: 'help-circle', name: '未分類' }; 
                                    const txType = window.TX_TYPES[tx.type] || { label: '未知', color: 'text-gray-500' }; 
                                    let display = cat.name;
                                    if(tx.type === 'transfer') { const to = userAccounts.find(a=>a.id===tx.toAccountId); const from = userAccounts.find(a=>a.id===tx.accountId); if (selectedAccount === tx.accountId) display = to ? `-> ${to.name}` : '轉出'; else if (selectedAccount === tx.toAccountId) display = from ? `<- ${from.name}` : '轉入'; } 
                                    else if(tx.type === 'repay' || tx.type === 'advance') { const target = tx.targetName || '-'; display = `${cat.name} (${target})`; }
                                    const amountVal = tx.amount || 0;
                                    const textColorClass = tx.type === 'expense' ? 'text-rose-500' : (tx.type === 'income' ? 'text-emerald-500' : txType.color);
                                    let sign = '';
                                    if (tx.type === 'expense') sign = '-'; else if (tx.type === 'income') sign = '+'; else if (tx.type === 'transfer') sign = selectedAccount === tx.accountId ? '-' : '+'; else if (tx.type === 'repay') sign = '+'; else if (tx.type === 'advance') sign = '-';
                                    const balance = balanceMap[tx.id];
                                    const isSettled = tx.isSettled; // NEW

                                    return (
                                        <div key={tx.id} onClick={() => openEdit(tx)} className={`grid grid-cols-[5rem_6rem_4rem_7rem_6rem_6rem_1fr] items-center border-b border-muji-border/50 hover:bg-muji-hover transition-colors cursor-pointer text-sm ${isSettled ? 'opacity-50' : ''}`}>
                                            <div className="p-4 flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                <input type="checkbox" className="w-4 h-4 accent-muji-accent cursor-pointer" checked={selectedTxIds.includes(tx.id)} onChange={() => toggleSelectTx(tx.id)} />
                                                <button onClick={(e) => { e.stopPropagation(); handleDuplicateTx(tx); }} className="p-1 text-muji-muted hover:text-muji-accent transition-colors" title="複製並新增一筆"><i data-lucide="copy" className="w-3.5 h-3.5"></i></button>
                                            </div>
                                            <div className="p-4 text-center font-mono text-xs">{tx.date}</div>
                                            <div className={`p-4 text-center font-bold ${txType.color} text-xs px-1 whitespace-nowrap ${isSettled ? 'line-through decoration-muji-text/50' : ''}`}>{txType.label}</div>
                                            <div className={`p-4 text-center text-xs gap-2 flex justify-center items-center ${isSettled ? 'line-through decoration-muji-text/50' : ''}`}>{(tx.type==='expense'||tx.type==='income')&&
                                                <span className="flex">
                                                    <i data-lucide={cat.icon || 'circle'} className="w-4 h-4"></i>
                                                </span>
                                            }<span className="truncate">{display}</span></div>
                                            <div className={`p-4 text-right font-mono font-bold ${textColorClass} text-xs ${isSettled ? 'line-through decoration-muji-text/50' : ''}`}><span>{sign}${amountVal.toLocaleString()}</span></div>
                                            <div className={`p-4 text-right font-mono text-xs text-muji-muted`}>{balance !== undefined ? `$${balance.toLocaleString()}` : '-'}</div>
                                            <div className={`p-4 pl-4 text-left text-muji-muted text-xs truncate ${isSettled ? 'line-through' : ''}`}>{tx.note}{isSettled ? ' (已結清)' : ''}</div>
                                        </div>
                                    ) 
                                }
                            })
                        )}
                    </div>
               </div>
               
               {/* Modals ... */}
               {showDatePicker && (<window.Modal title="選擇日期" onClose={() => setShowDatePicker(false)}><div className="p-4"><div className="flex justify-between items-center mb-4 px-2"><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1))} className="p-2 hover:bg-muji-bg rounded-full"><i data-lucide="chevron-left" className="w-5 h-5"></i></button><span className="text-xl font-bold font-mono">{currentDate.getFullYear()}</span><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1))} className="p-2 hover:bg-muji-bg rounded-full"><i data-lucide="chevron-right" className="w-5 h-5"></i></button></div><div className="grid grid-cols-4 gap-2">{Array.from({length: 12}, (_, i) => i).map(m => { const hasData = monthsWithData.has(m); const isSelected = currentDate.getMonth() === m; return (<button key={m} onClick={() => { setCurrentDate(new Date(currentDate.getFullYear(), m, 1)); setShowDatePicker(false); }} className={`py-3 rounded-lg text-sm font-bold transition-colors relative ${isSelected ? 'bg-muji-accent text-white shadow-md' : hasData ? 'bg-white text-muji-text border border-muji-accent/30 shadow-sm hover:border-muji-accent' : 'bg-muji-bg text-muji-muted/50 hover:bg-gray-200'}`}>{m+1}月{hasData && !isSelected && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-muji-accent"></div>}</button>); })}</div></div></window.Modal>)}
               {showDeleteBatchConfirm && (<window.Modal title="刪除確認" onClose={() => setShowDeleteBatchConfirm(false)}><div className="p-4 text-center space-y-4"><p className="text-muji-text">確定要刪除選取的 <span className="font-bold">{selectedTxIds.length}</span> 筆資料嗎？</p><p className="text-xs text-muji-red">此操作無法復原！</p><div className="flex gap-3"><button onClick={() => setShowDeleteBatchConfirm(false)} className="flex-1 py-3 border border-muji-border rounded-lg">取消</button><button onClick={confirmBatchDelete} className="flex-1 py-3 bg-muji-red text-white font-bold rounded-lg shadow-sm">確認刪除</button></div></div></window.Modal>)}
               {showImport && <window.SmartImportModal onClose={() => setShowImport(false)} importText={importText} setImportText={setImportText} previewData={previewData} setPreviewData={setPreviewData} saveData={saveData} data={data} handleSmartImport={handleSmartImport} flatCategories={flatCategories} userAccounts={userAccounts} selectedAccount={selectedAccount} />}
               {showAdd && <window.TransactionModal onClose={() => setShowAdd(false)} isEditMode={isEditMode} newTx={newTx} setNewTx={setNewTx} isSplitMode={isSplitMode} setIsSplitMode={setIsSplitMode} splitTotal={splitTotal} setSplitTotal={setSplitTotal} splits={splits} setSplits={setSplits} categoryGroups={categoryGroups} flatCategories={flatCategories} userAccounts={userAccounts} selectedAccount={selectedAccount} saveTransaction={handleSaveTransaction} handleDeleteTransaction={handleDeleteTransaction} data={data} saveData={saveData} showToast={showToast} />}
            </div>
        );
    }
    
    // Account List View
    const recentAccounts = getRecentAccounts(); 

    return (
        <div className="p-6 md:p-10 animate-fade relative min-h-full">
            <div className="sticky top-0 z-10 bg-muji-bg flex justify-between items-center py-4 mb-6 -mt-6 -mx-6 px-6 md:-mt-10 md:-mx-10 md:px-10 border-b border-muji-border/50 backdrop-blur-sm bg-muji-bg/95">
                <h3 className="text-2xl font-bold text-muji-text">我的帳戶</h3>
                <div className="flex gap-2">
                    {/* NEW: Tab Switcher (Visible only in List View Mode) */}
                    <div className="flex bg-muji-bg rounded-lg p-1 border border-muji-border mr-2">
                        <button onClick={() => setActiveTab('expense_list')} className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 ${activeTab === 'expense_list' ? 'bg-white shadow-sm text-muji-accent' : 'text-muji-muted hover:text-muji-text'}`}>
                            <i data-lucide="list" className="w-3 h-3"></i> 本月支出
                        </button>
                        <button onClick={() => setActiveTab('all_grid')} className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 ${activeTab === 'all_grid' ? 'bg-white shadow-sm text-muji-accent' : 'text-muji-muted hover:text-muji-text'}`}>
                            <i data-lucide="grid" className="w-3 h-3"></i> 所有帳戶
                        </button>
                    </div>

                    <button onClick={() => setInputModal({ show: true, title: '新增帳戶', value: '', type: 'add_account', extra: 'cash', value2: '' })} className="bg-muji-card border border-muji-border hover:border-muji-accent text-muji-text hover:text-muji-accent p-2 md:px-4 md:py-2 rounded-lg transition flex items-center gap-2 font-bold shadow-sm text-sm"><i data-lucide="plus" className="w-4 h-4"></i> <span className="hidden sm:inline">新增</span></button>
                </div>
            </div>
            
            {/* Conditional Rendering based on activeTab */}
            {activeTab === 'expense_list' ? (
                <div className="animate-fade">
                    <div className="mb-4 p-4 bg-white rounded-xl border border-muji-border shadow-sm flex justify-between items-center">
                         <span className="text-sm font-bold text-muji-text">本月總支出</span>
                         <span className="text-xl font-mono font-bold text-rose-500">${totalMonthlyExpenseSum.toLocaleString()}</span>
                    </div>
                    
                    {monthlyExpenseAccounts.length > 0 ? (
                        <div className="space-y-3">
                            {monthlyExpenseAccounts.map(acc => {
                                const expense = accountMonthlyExpenses[acc.id] || 0;
                                const typeConfig = accountTypes[acc.type] || { icon: 'circle-help' };
                                return (
                                    <div 
                                        key={acc.id} 
                                        onClick={() => setSelectedAccount(acc.id)} 
                                        className="bg-white p-4 rounded-xl border border-muji-border hover:border-muji-accent hover:shadow-md transition-all cursor-pointer flex justify-between items-center"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
                                                <i data-lucide={typeConfig.icon} className="w-5 h-5"></i>
                                            </div>
                                            <div className="font-bold text-base text-muji-text">{acc.name}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-mono font-bold text-rose-500">${expense.toLocaleString()}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-10 text-center text-muji-muted border border-dashed border-muji-border rounded-xl">
                            本月尚無支出紀錄
                        </div>
                    )}
                </div>
            ) : (
                /* Existing Grid View Content (Recent + Categories) */
                <div className="animate-fade">
                    {recentAccounts.length > 0 && (
                         <div className="mb-6">
                            <button onClick={() => toggleSection('recent')} className="w-full text-left flex items-center gap-2 mb-3 pb-1 border-b border-muji-border"><i data-lucide={expandedTypes.includes('recent') ? "chevron-down" : "chevron-right"} className="w-4 h-4 text-muji-muted"></i><h4 className="text-muji-muted text-sm font-bold flex items-center gap-2"><i data-lucide="clock" className="w-4 h-4"></i> 最近記帳</h4></button>
                            {expandedTypes.includes('recent') && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade">
                                    {recentAccounts.map(acc => { const bal = window.calculateBalance(data, acc.id); const isPositive = bal >= 0; const typeConfig = accountTypes[acc.type] || { icon: 'circle-help' }; const expense = accountMonthlyExpenses[acc.id] || 0; return (<div key={'recent_' + acc.id} onClick={() => setSelectedAccount(acc.id)} className="bg-white p-4 rounded-xl border border-muji-border hover:border-muji-accent hover:shadow-md transition-all cursor-pointer relative group h-32 flex flex-col justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full border-2 border-muji-text/20 flex items-center justify-center text-muji-text text-xl"><i data-lucide={typeConfig.icon} className="w-5 h-5"></i></div><div className="font-bold text-base text-muji-text truncate">{acc.name}</div></div><div className="text-right"><div className={`text-xl font-mono font-bold ${isPositive ? 'text-muji-green' : 'text-rose-500'}`}>${bal.toLocaleString()}</div>{expense > 0 && (<div className="text-xs text-rose-500 font-bold mt-1">本月支出: ${expense.toLocaleString()}</div>)}</div></div>); })}
                                </div>
                            )}
                         </div>
                     )}

                    {Object.entries(accountTypes).map(([typeKey, typeConfig]) => {
                        const typeAccounts = userAccounts.filter(a => a.type === typeKey);
                        if (typeAccounts.length === 0) return null;
                        const isExpanded = expandedTypes.includes(typeKey);
                        
                        // Sorted Accounts by Last Modified Date
                        const sortedTypeAccounts = typeAccounts.sort((a, b) => {
                            const dateA = accountLastModified[a.id] || 0;
                            const dateB = accountLastModified[b.id] || 0;
                            return dateB - dateA; // Descending
                        });

                        return (
                            <div key={typeKey} className="mb-6">
                                <button onClick={() => toggleSection(typeKey)} className="w-full text-left flex items-center gap-2 mb-3 pb-1 border-b border-muji-border"><i data-lucide={isExpanded ? "chevron-down" : "chevron-right"} className="w-4 h-4 text-muji-muted"></i><h4 className="text-muji-muted text-sm font-bold flex items-center gap-2"><i data-lucide={typeConfig.icon} className="w-4 h-4"></i> {typeConfig.label}</h4></button>
                                {isExpanded && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade">
                                        {sortedTypeAccounts.map(acc => { 
                                            const bal = window.calculateBalance(data, acc.id); const isPositive = bal >= 0;
                                            const expense = accountMonthlyExpenses[acc.id] || 0;
                                            return (
                                                <div 
                                                    key={acc.id} 
                                                    onDragOver={(e) => handleDragOver(e, acc.id)} 
                                                    onDrop={(e) => handleDrop(e, acc.id)} 
                                                    onClick={() => setSelectedAccount(acc.id)} 
                                                    className="bg-white p-4 rounded-xl border border-muji-border hover:border-muji-accent hover:shadow-md transition-all cursor-pointer relative group h-32 flex flex-col justify-between"
                                                >
                                                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-2">
                                                        <button onClick={(e) => {e.stopPropagation(); setInputModal({ show: true, title: '餘額校正', value: bal.toString(), type: 'calibrate_account', data: acc.id, extra: bal });}} className="p-1 hover:bg-muji-bg rounded text-muji-muted hover:text-muji-accent"><i data-lucide="sliders-horizontal" className="w-3 h-3"></i></button>
                                                        <button onClick={(e) => {e.stopPropagation(); setInputModal({ show: true, title: '修改帳戶', value: acc.name, value2: acc.balance || 0, type: 'rename_account', data: acc.id, extra: acc.type });}} className="p-1 hover:bg-muji-bg rounded text-muji-muted hover:text-muji-accent"><i data-lucide="pencil" className="w-3 h-3"></i></button>
                                                        <button onClick={(e) => {e.stopPropagation(); setInputModal({ show: true, title: '刪除', value: '確認', type: 'delete_account', data: acc.id });}} className="p-1 hover:bg-muji-bg rounded text-muji-muted hover:text-muji-red"><i data-lucide="trash-2" className="w-3 h-3"></i></button>
                                                    </div>
                                                    <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full border-2 border-muji-text/20 flex items-center justify-center text-muji-text text-xl"><i data-lucide={typeConfig.icon} className="w-5 h-5"></i></div><div className="font-bold text-base text-muji-text truncate">{acc.name}</div></div>
                                                    <div className="text-right">
                                                        <div className={`text-xl font-mono font-bold ${isPositive ? 'text-muji-green' : 'text-rose-500'}`}>${bal.toLocaleString()}</div>
                                                        {expense > 0 && (
                                                            <div className="text-xs text-rose-500 font-bold mt-1">本月支出: ${expense.toLocaleString()}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ); 
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};