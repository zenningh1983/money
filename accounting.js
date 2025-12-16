const { useState, useEffect, useMemo, useCallback } = React;

const CategorySelector = ({ type, categoryGroups, selectedGroup, setSelectedGroup, onSelectCategory, currentCategory }) => {
    if (!['expense', 'income'].includes(type)) return null;
    const groups = categoryGroups[type] || [];
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
        const handleSwap = () => {
            if (onChange) {
                onChange('swap_accounts', { from: accountId, to: toAccountId });
            }
        };

        return (
            <div className="flex gap-2 mt-1 w-full items-end">
                <div className="flex-1 flex flex-col gap-1">
                    <label className="text-xs text-muji-muted">轉出帳戶 (From)</label>
                    <select 
                        className="p-2 bg-muji-card rounded border border-muji-border text-sm w-full text-muji-text" 
                        value={accountId} 
                        onChange={e => onChange('accountId', e.target.value)}
                    >
                        <option value="">選擇帳戶</option>
                        {userAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
                <div className="flex items-center pb-2 text-muji-muted">
                    <button onClick={handleSwap} className="p-1 hover:bg-muji-bg rounded-full transition-colors" title="交換帳戶">
                        <i data-lucide="arrow-right-left" className="w-4 h-4"></i>
                    </button>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                    <label className="text-xs text-muji-muted">轉入帳戶 (To)</label>
                    <select 
                        className="p-2 bg-muji-card rounded border border-muji-border text-sm w-full text-muji-text" 
                        value={toAccountId} 
                        onChange={e => onChange('toAccountId', e.target.value)}
                    >
                        <option value="">選擇帳戶</option>
                        {userAccounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
            </div>
        );
    }
    return null;
};

const SplitSection = ({ amount, splits, setSplits, debtTargets, onAddTarget, flatCategories, isWithOthersMode, categoryGroups }) => {
    const totalAmount = parseFloat(amount) || 0;
    const safeSplits = Array.isArray(splits) ? splits : [];
    
    // State for modal category selection
    const [selectingCategoryIdx, setSelectingCategoryIdx] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState('food'); // Default group for selector

    // Auto-init "Me" row only if splits are completely empty and amount is set
    useEffect(() => {
        if (safeSplits.length === 0 && totalAmount > 0) {
            setSplits([{ 
                owner: 'me', 
                name: '我', 
                amount: totalAmount, 
                percent: '',
                categoryId: Object.keys(flatCategories)[0] || 'food_三餐'
            }]);
        }
    }, [totalAmount]); 

    const splitTotal = safeSplits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    const isValid = Math.abs(totalAmount - splitTotal) < 1;

    const addSplit = () => {
        const newSplit = { 
            owner: 'me', 
            name: '我', 
            amount: 0, 
            percent: '',
            categoryId: safeSplits[0]?.categoryId || 'food_三餐' 
        };
        setSplits([...safeSplits, newSplit]);
    };
    
    const updateSplit = (idx, field, val) => {
        let newSplits = [...safeSplits];
        let newSplit = { ...newSplits[idx], [field]: val };

        if(field === 'categoryId') {
            // Just update category
        } else if (field === 'owner') {
            if (val === 'me') {
                newSplit.name = '我';
                newSplit.percent = '';
            } else if (val === '__add_new__') {
                const newT = prompt("輸入新對象姓名");
                if (newT) {
                    onAddTarget(newT);
                    newSplit.owner = newT;
                    newSplit.name = newT;
                } else {
                    return; 
                }
            } else {
                newSplit.name = val;
                const targetObj = debtTargets.find(t => t.name === val);
                if (targetObj && targetObj.defaultPercent) {
                    const pct = parseFloat(targetObj.defaultPercent);
                    newSplit.percent = pct;
                    newSplit.amount = Math.round(totalAmount * (pct / 100));
                }
            }
        } else if (field === 'percent') { 
            const pct = parseFloat(val); 
            if (!isNaN(pct)) {
                newSplit.amount = Math.round(totalAmount * (pct / 100)); 
            } else {
                newSplit.percent = '';
            }
        } else if (field === 'amount') {
            newSplit.percent = '';
        }

        newSplits[idx] = newSplit;

        // Auto-balance logic: Find first "Me" row and adjust it
        const mainMeIndex = newSplits.findIndex(s => s.owner === 'me');
        if (mainMeIndex !== -1 && idx !== mainMeIndex) {
            const otherSum = newSplits.reduce((sum, s, i) => {
                if (i === mainMeIndex) return sum;
                return sum + (parseFloat(s.amount) || 0);
            }, 0);
            
            const residual = totalAmount - otherSum;
            if (residual >= 0) {
                newSplits[mainMeIndex] = { ...newSplits[mainMeIndex], amount: residual, percent: '' };
            }
        }

        setSplits(newSplits);
    };
    
    const removeSplit = (idx) => {
        let newSplits = safeSplits.filter((_, i) => i !== idx);
        // If we removed a row, try to give back to "Me"
        const mainMeIndex = newSplits.findIndex(s => s.owner === 'me');
        if (mainMeIndex !== -1) {
             const otherSum = newSplits.reduce((sum, s, i) => {
                if (i === mainMeIndex) return sum;
                return sum + (parseFloat(s.amount) || 0);
            }, 0);
            newSplits[mainMeIndex] = { ...newSplits[mainMeIndex], amount: totalAmount - otherSum };
        }
        setSplits(newSplits);
    };

    return (
        <div className="mt-4 p-3 bg-muji-bg rounded-lg border border-muji-border text-sm animate-fade">
            <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-muji-text">分帳 / 多類別明細</span>
                <span className={`text-xs font-mono ${isValid ? 'text-muji-green' : 'text-muji-red'}`}>
                    合計: ${splitTotal.toLocaleString()} {isValid ? 'OK' : `(差 ${totalAmount - splitTotal})`}
                </span>
            </div>
            <div className="space-y-2">
                {safeSplits.map((s, idx) => {
                    const cat = flatCategories[s.categoryId] || {};
                    return (
                        <div key={idx} className="flex flex-col gap-1 p-2 bg-white rounded border border-muji-border shadow-sm">
                            <div className="flex gap-2">
                                <select 
                                    className="w-1/3 p-1.5 bg-muji-bg rounded border border-muji-border text-xs text-muji-text font-bold" 
                                    value={s.owner === 'me' ? 'me' : s.name} 
                                    onChange={e => updateSplit(idx, 'owner', e.target.value)}
                                >
                                    <option value="me">我</option>
                                    <optgroup label="分帳對象">
                                        {debtTargets.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                    </optgroup>
                                    <option value="__add_new__">+ 新增對象...</option>
                                </select>
                                
                                {/* Trigger Category Selector */}
                                <button 
                                    className="flex-1 p-1.5 bg-muji-bg rounded border border-muji-border text-xs text-muji-text flex items-center justify-between"
                                    onClick={() => {
                                        setSelectingCategoryIdx(idx);
                                        // Set initial group
                                        if (cat.group) {
                                            let foundGroupId = 'food';
                                            for(let type in categoryGroups) {
                                                for(let g of categoryGroups[type]) {
                                                    if(g.label === cat.group) {
                                                        foundGroupId = g.id;
                                                        break;
                                                    }
                                                }
                                            }
                                            setSelectedGroup(foundGroupId);
                                        }
                                    }}
                                >
                                    <span className="flex items-center gap-1">
                                        {cat.icon && <i data-lucide={cat.icon} className="w-3 h-3"></i>}
                                        {cat.name || '選擇分類'}
                                    </span>
                                    <i data-lucide="chevron-down" className="w-3 h-3 text-muji-muted"></i>
                                </button>
                            </div>
                            <div className="flex gap-2 items-center">
                                <div className="relative w-20">
                                    <input 
                                        type="number" 
                                        className="w-full p-1.5 pl-1 pr-4 bg-white rounded border border-muji-border text-xs text-center text-muji-text font-mono" 
                                        placeholder="%" 
                                        value={s.percent || ''} 
                                        onChange={e => updateSplit(idx, 'percent', e.target.value)} 
                                    />
                                    <span className="absolute right-1.5 top-1.5 text-xs text-muji-muted">%</span>
                                </div>
                                <span className="text-muji-muted text-xs">or</span>
                                <div className="relative flex-1">
                                    <span className="absolute left-2 top-1.5 text-xs text-muji-muted">$</span>
                                    <input 
                                        type="number" 
                                        className="w-full p-1.5 pl-4 bg-white rounded border border-muji-border text-xs text-muji-text font-mono font-bold" 
                                        placeholder="金額" 
                                        value={s.amount} 
                                        onChange={e => updateSplit(idx, 'amount', e.target.value)} 
                                    />
                                </div>
                                <button onClick={() => removeSplit(idx)} className="p-1.5 text-muji-muted hover:text-muji-red hover:bg-muji-bg rounded transition-colors"><i data-lucide="trash-2" className="w-4 h-4"></i></button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <button onClick={addSplit} className="w-full py-2 border border-dashed border-muji-accent text-muji-accent text-xs rounded hover:bg-white transition-colors flex items-center justify-center gap-1 mt-3"><i data-lucide="plus" className="w-3 h-3"></i> 新增明細 (分帳/多類別)</button>

            {/* Category Selection Modal */}
            {selectingCategoryIdx !== null && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop" onClick={() => setSelectingCategoryIdx(null)}>
                    <div className="bg-muji-card w-full max-w-sm rounded-xl shadow-2xl overflow-hidden border border-muji-border flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-muji-border flex justify-between items-center bg-muji-bg">
                            <h3 className="font-bold text-lg text-muji-text">選擇分類</h3>
                            <button onClick={() => setSelectingCategoryIdx(null)} className="p-2 hover:bg-black/5 rounded-full"><i data-lucide="x" className="w-5 h-5 text-muji-muted"></i></button>
                        </div>
                        <div className="p-4 overflow-y-auto custom-scrollbar">
                            <CategorySelector 
                                type="expense" // Split is usually for expense
                                categoryGroups={categoryGroups}
                                selectedGroup={selectedGroup}
                                setSelectedGroup={setSelectedGroup}
                                onSelectCategory={(catId) => {
                                    updateSplit(selectingCategoryIdx, 'categoryId', catId);
                                    setSelectingCategoryIdx(null);
                                }}
                                currentCategory={safeSplits[selectingCategoryIdx]?.categoryId}
                            />
                        </div>
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

    const doSmartImport = () => {
        handleSmartImport(targetAccountId);
    };

    const handleAttemptClose = (reason) => {
        if (reason === 'close_btn') {
            // "叉叉不用問" (Directly close on X click)
            onClose();
        } else {
             // "其他點外面或是 esc key 要問" (Show confirm for backdrop or Esc)
             if (previewData.length > 0 || importText.trim().length > 0) {
                 setShowExitConfirm(true);
             } else {
                 onClose();
             }
        }
    };

    const confirmClose = () => {
        setShowExitConfirm(false);
        onClose();
    };

    return (
        <window.Modal title="AI 記帳" onClose={handleAttemptClose}>
            {previewData.length === 0 ? (
                <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                        <label htmlFor="import-target-account" className="text-xs text-muji-muted font-bold">匯入至帳戶</label>
                        <select 
                            id="import-target-account"
                            name="targetAccountId"
                            className="w-full p-2 bg-muji-card rounded border border-muji-border text-sm text-muji-text" 
                            value={targetAccountId} 
                            onChange={(e) => setTargetAccountId(e.target.value)}
                        >
                            {userAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="import-text-area" className="text-sm text-muji-muted mb-2 block">貼上網銀/Excel/文字 (支援信用卡與網銀格式)：</label>
                        <textarea 
                            id="import-text-area"
                            name="importText"
                            className="w-full h-40 p-3 bg-white rounded-lg text-sm border border-muji-border focus:border-muji-accent outline-none text-muji-text" 
                            placeholder="直接貼上..." 
                            value={importText} 
                            onChange={e => setImportText(e.target.value)}
                        ></textarea>
                    </div>
                    <button onClick={doSmartImport} className="w-full py-3 bg-muji-accent text-white rounded-lg font-bold shadow-sm">解析</button>
                </div>
            ) : (
                <div className="space-y-4">
                    {!showCategoryPicker ? (
                        <>
                            <div className="max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar pr-1">
                                {previewData.map((item, idx) => (
                                    <div key={item.id || idx} className="flex flex-col gap-2 p-3 bg-muji-card rounded-lg text-sm border border-muji-border shadow-sm">
                                        <div className="flex justify-between items-center gap-2">
                                            <input type="date" aria-label="交易日期" className="bg-transparent border-b border-muji-border focus:border-muji-accent outline-none font-mono text-muji-text w-28 text-xs" value={item.date} onChange={(e) => { const n = [...previewData]; n[idx].date = e.target.value; setPreviewData(n); }} />
                                            <select aria-label="交易類型" className={`bg-transparent font-bold outline-none cursor-pointer text-xs flex-1 ${window.TX_TYPES[item.type]?.color || 'text-muji-text'}`} value={item.type} onChange={(e) => { const n = [...previewData]; n[idx].type = e.target.value; n[idx].toAccountId = ''; n[idx].targetName = ''; setPreviewData(n); }}>{Object.entries(window.TX_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                                            <div className="flex items-center gap-1"><input type="number" aria-label="金額" className="bg-transparent font-bold font-mono outline-none w-20 text-right border-b border-muji-border focus:border-muji-accent text-muji-text" value={item.amount} onChange={(e) => { const n = [...previewData]; n[idx].amount = parseFloat(e.target.value); setPreviewData(n); }} /></div>
                                            <button aria-label="刪除" onClick={() => setPreviewData(previewData.filter((_, i) => i !== idx))} className="text-muji-muted hover:text-muji-red"><i data-lucide="trash-2" className="w-4 h-4"></i></button>
                                        </div>
                                        <div className="flex items-center gap-2"><span className="text-xs text-muji-muted whitespace-nowrap">帳戶:</span><select aria-label="帳戶" className="bg-transparent text-xs border-b border-muji-muted/30 focus:border-muji-accent outline-none flex-1 text-muji-text" value={item.accountId} onChange={(e) => { const n = [...previewData]; n[idx].accountId = e.target.value; setPreviewData(n); }}>{userAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}</select></div>
                                        <div className="flex items-center gap-2">{(item.type === 'expense' || item.type === 'income') && (<button onClick={() => { setEditingPreviewIndex(idx); setShowCategoryPicker(true); }} className="flex-1 text-left px-2 py-1.5 rounded bg-white border border-muji-border text-xs flex items-center gap-2 hover:border-muji-accent text-muji-text"><i data-lucide={flatCategories[item.categoryId]?.icon || 'tag'} className="w-3 h-3"></i>{flatCategories[item.categoryId]?.name || '選擇分類'}</button>)}<ExtraFieldsInput type={item.type} accountId={item.accountId} toAccountId={item.toAccountId} targetName={item.targetName} userAccounts={userAccounts} selectedAccount={item.accountId} onChange={(k, v) => { const n = [...previewData]; n[idx][k] = v; setPreviewData(n); }} debtTargets={data.debtTargets} onAddTarget={() => {}} /></div>
                                        <input type="text" aria-label="備註" className="w-full bg-transparent border-b border-muji-border focus:border-muji-accent outline-none text-muji-text text-xs placeholder-muji-muted" placeholder="備註..." value={item.note} onChange={(e) => { const n = [...previewData]; n[idx].note = e.target.value; setPreviewData(n); }} />
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2 pt-2"><button onClick={() => setPreviewData([])} className="flex-1 py-3 bg-white text-muji-text rounded-lg font-bold border border-muji-border">放棄</button><button onClick={() => { saveData({...data, transactions: [...data.transactions, ...previewData], debtTargets: data.debtTargets }); setPreviewData([]); onClose(); }} className="flex-[2] py-3 bg-muji-accent text-white rounded-lg font-bold shadow-sm">確認匯入 ({previewData.length})</button></div>
                        </>
                    ) : (
                        <div className="animate-fade">
                            <div className="flex justify-between items-center mb-4"><h4 className="font-bold text-muji-text">選擇分類</h4><button onClick={() => setShowCategoryPicker(false)} className="text-muji-muted">取消</button></div>
                            <CategorySelector type={previewData[editingPreviewIndex].type} categoryGroups={window.DEFAULT_CATEGORY_GROUPS} selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup} onSelectCategory={(catId) => { 
                                const n = [...previewData]; 
                                n[editingPreviewIndex].categoryId = catId; 
                                setPreviewData(n); 
                                setShowCategoryPicker(false); 
                            }} currentCategory={previewData[editingPreviewIndex].categoryId} />
                        </div>
                    )}
                </div>
            )}
            
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

window.TransactionModal = ({ onClose, isEditMode, newTx, setNewTx, isSplitMode, setIsSplitMode, splitTotal, setSplitTotal, splits, setSplits, categoryGroups, flatCategories, userAccounts, selectedAccount, saveTransaction, handleDeleteTransaction, data, saveData }) => {
    const [selectedGroup, setSelectedGroup] = useState(flatCategories[newTx.categoryId]?.group || 'food');
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
        if (newTx.type === 'expense' && isSplitMode) {
             const safeSplits = (splits || []).filter(s => s.name && parseFloat(s.amount) > 0);
             const total = parseFloat(splitTotal || 0);
             const splitSum = safeSplits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
             const diff = total - splitSum;
             
             if (diff > 1) {
                 setPendingBalanceDiff(diff);
                 setShowBalanceConfirm(true);
                 return;
             } else if (diff < -1) {
                 return window.Toast({ message: '分帳金額超過總金額', type: 'error' });
             }

             const finalTx = { 
                ...newTx, 
                amount: total,
                splits: safeSplits
             };
             saveTransaction(finalTx, data.debtTargets); 

        } else {
             const finalTx = { ...newTx, splits: [] };
             saveTransaction(finalTx, data.debtTargets); 
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
        safeSplits.push({
             owner: 'me',
             name: '我',
             amount: pendingBalanceDiff,
             percent: '',
             categoryId: newTx.categoryId || 'food_三餐'
        });
        
        const finalTx = { 
            ...newTx, 
            amount: parseFloat(splitTotal || 0),
            splits: safeSplits
        };
        saveTransaction(finalTx, data.debtTargets);
        setShowBalanceConfirm(false);
    };

    const toggleSplitMode = () => {
         const nextMode = !isSplitMode;
         setIsSplitMode(nextMode);

         if (nextMode) {
             setSplitTotal(newTx.amount.toString() || '0');
             if ((newTx.splits || []).length === 0) {
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
                            
                            return (
                                <button 
                                    key={k} 
                                    disabled={isSplitMode && k !== 'expense'} 
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition whitespace-nowrap ${newTx.type === k ? 'bg-muji-card shadow-sm text-muji-accent border border-muji-border' : 'text-muji-muted'} ${isSplitMode && k !== 'expense' ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                    onClick={() => { 
                                        let defCat = 'food_三餐'; 
                                        let defGroup = 'food'; 
                                        if(k === 'income') { defCat = 'active_薪資'; defGroup = 'active'; }
                                        setNewTx({...newTx, type: k, categoryId: defCat}); 
                                        setSelectedGroup(defGroup); 
                                    }}
                                >
                                    {v.label}
                                </button>
                            );
                        })}
                    </div>
                    
                    {newTx.type === 'expense' && !newTx.isQuickAdd && (
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
                
                {newTx.type === 'expense' && isSplitMode ? (
                    <SplitSection 
                        amount={splitTotal} 
                        splits={splits} 
                        setSplits={setSplits} 
                        debtTargets={debtTargets} 
                        flatCategories={flatCategories}
                        isWithOthersMode={true} 
                        onAddTarget={handleAddTarget}
                        categoryGroups={categoryGroups} 
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
    const [showImport, setShowImport] = useState(false); const [importText, setImportText] = useState(''); const [previewData, setPreviewData] = useState([]);
    const [showAdd, setShowAdd] = useState(false); const [isEditMode, setIsEditMode] = useState(false); const [editingTxId, setEditingTxId] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date()); const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSplitMode, setIsSplitMode] = useState(false); const [splitTotal, setSplitTotal] = useState(''); const [splits, setSplits] = useState([]);
    const [newTx, setNewTx] = useState({ amount: '', note: '', type: 'expense', categoryId: 'food_伙食', date: new Date().toISOString().split('T')[0], toAccountId: '', targetName: '', splits: [] });

    // Multi-selection state
    const [selectedTxIds, setSelectedTxIds] = useState([]);
    const [showDeleteBatchConfirm, setShowDeleteBatchConfirm] = useState(false);

    const [expandedTypes, setExpandedTypes] = useState(['recent']); 

    const categoryGroups = data.settings?.categoryGroups || window.DEFAULT_CATEGORY_GROUPS;
    const flatCategories = useMemo(() => window.getFlatCategories(categoryGroups), [categoryGroups]);
    
    useEffect(() => { if (window.lucide && (showAdd || showImport || showDatePicker)) setTimeout(() => window.lucide.createIcons(), 50); }, [showAdd, isEditMode, showImport, previewData, showDatePicker, expandedTypes]);

    const getCurrentUserAccounts = () => data.accounts.filter(a => a.userId === data.currentUser || (!a.userId && data.currentUser === 'default'));
    const userAccounts = getCurrentUserAccounts();

    // Helper to calculate recent accounts
    const getRecentAccounts = () => {
        const txs = data.transactions
            .filter(t => userAccounts.some(acc => acc.id === t.accountId))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const recentAccountIds = [...new Set(txs.map(t => t.accountId))].slice(0, 3);
        return userAccounts.filter(acc => recentAccountIds.includes(acc.id));
    };

    // Calculate running balances for all transactions of this account
    const balanceMap = useMemo(() => {
        if (!selectedAccount) return {};
        const acc = data.accounts.find(a => a.id === selectedAccount);
        const initial = acc?.balance || 0;
        
        // Get ALL transactions for this account, sorted chronologically (Oldest -> Newest)
        const allTxs = data.transactions.filter(t => 
            t.accountId === selectedAccount || t.toAccountId === selectedAccount
        ).sort((a, b) => {
             const dateDiff = new Date(a.date) - new Date(b.date);
             if (dateDiff !== 0) return dateDiff;
             if (a.id < b.id) return -1;
             if (a.id > b.id) return 1;
             return 0;
        });

        const map = {};
        let currentBal = initial;

        allTxs.forEach(tx => {
            const amount = parseFloat(tx.amount) || 0;
            
            if (tx.type === 'income' || (tx.type === 'repay' && tx.accountId === selectedAccount)) {
                 currentBal += amount;
            } else if (tx.type === 'expense' || (tx.type === 'advance' && tx.accountId === selectedAccount)) {
                 currentBal -= amount;
            } else if (tx.type === 'transfer') {
                 if (tx.toAccountId === selectedAccount) {
                     currentBal += amount;
                 } else if (tx.accountId === selectedAccount) {
                     currentBal -= amount;
                 }
            }
            
            map[tx.id] = currentBal;
        });
        
        return map;
    }, [data.transactions, selectedAccount, data.accounts]);

    const handleSmartImport = (targetAccountId, hintType) => {
        const rawLines = importText.split('\n').map(l => l.trim()).filter(l => l);
        const parsed = [];
        const currentYear = new Date().getFullYear();
        const parseNum = (str) => parseFloat(str.replace(/,/g, ''));
        const isNum = (str) => /^\d{1,3}(,\d{3})*(\.\d+)?$/.test(str);
        
        // Regex patterns
        const dateRegexFull = /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/;
        const dateRegexShort = /^(\d{1,2})[\/\-\.](\d{1,2})/;
        
        const detectTransferTarget = (note) => {
             if (note.includes('(013)') || note.includes('國泰')) {
                  const targetAcc = userAccounts.find(a => a.name.includes('國泰') || a.name.includes('銀行'));
                  if (targetAcc) return targetAcc.id;
             }
             if (note.includes('(012)') || note.includes('富邦信用卡')) {
                 const targetAcc = userAccounts.find(a => a.name.includes('富邦') || a.name.includes('信用卡'));
                 if (targetAcc) return targetAcc.id;
             }
             if (note.includes('(823)') || note.includes('將來')) {
                  const targetAcc = userAccounts.find(a => a.name.includes('將來'));
                  if (targetAcc) return targetAcc.id;
             }
             if (note.includes('700') && note.includes('27210469163')) {
                  const targetAcc = userAccounts.find(a => a.name.includes('郵局'));
                  if (targetAcc) return targetAcc.id;
             }
             return null;
        };
        
        let currentBlock = [];

        const processBlock = (block) => {
            if (block.length === 0) return;
            try {
                // Determine Date
                const dateLine = block[0];
                let dateMatch = dateLine.match(dateRegexFull);
                let dateStr = "";
                
                if (dateMatch) {
                    dateStr = dateMatch[0].replace(/[\-\.]/g, '/');
                } else {
                    dateMatch = dateLine.match(dateRegexShort);
                    if (dateMatch) {
                        dateStr = `${currentYear}/${dateMatch[0].replace(/[\-\.]/g, '/')}`;
                    }
                }
                
                if (!dateStr) return;
                const valid = new Date(dateStr);
                if (isNaN(valid.getTime())) return;
                dateStr = valid.toISOString().split('T')[0];

                // Find Amount and Type using Token Analysis
                let amount = 0;
                let type = 'expense';
                let foundAmount = false;

                // Loop through lines to find amount
                for (let i = 0; i < block.length; i++) {
                    let content = block[i].replace(/−/g, '-').replace(/\t/g, ' ');
                    const tokens = content.split(/\s+/).filter(t => t.trim() !== '');
                    for (let j = 0; j < tokens.length; j++) {
                        const token = tokens[j];
                        const nextToken = tokens[j+1];
                        if (token.includes('/') || token.includes(':')) continue; 

                        if (isNum(token)) {
                            // [Amount] - (Expense)
                            if (nextToken === '-') {
                                amount = parseNum(token);
                                type = 'expense';
                                foundAmount = true;
                                break;
                            }
                            // Single number line
                            if (tokens.length === 1 && !foundAmount) {
                                amount = parseNum(token);
                                type = 'expense';
                                foundAmount = true;
                                break;
                            }
                            // TWD [Amount]
                            if (token.toUpperCase() === 'TWD' && isNum(nextToken)) {
                                amount = parseNum(nextToken);
                                type = 'expense';
                                foundAmount = true;
                                break;
                            }
                             // Simple Table Row: Date Desc Amount
                             if (!foundAmount && block.length === 1 && j === tokens.length - 1) {
                                 amount = parseNum(token);
                                 type = 'expense';
                                 foundAmount = true;
                                 break;
                             }
                        } else if (token === '-') {
                            // - [Amount] (Income)
                            if (isNum(nextToken)) {
                                amount = parseNum(nextToken);
                                type = 'income';
                                foundAmount = true;
                                break;
                            }
                        }
                    }
                    if (foundAmount) break;
                }
                
                if (!foundAmount || amount === 0) return;

                // Construct Note
                let noteParts = [];
                block.forEach((line, i) => {
                    let content = line.replace(/−/g, '-').replace(/\t/g, ' ');
                    if (i === 0 && dateMatch) content = content.replace(dateMatch[0], '');
                    const noise = ['網銀轉帳', '信用卡款', '電子轉出', '跨行提款', '交易資訊', '備註', '說明', 'TWD', 'TW', '新臺幣金額', '交易說明', '消費日', '消費店家', '金額', '提款'];
                    noise.forEach(n => content = content.replace(n, ''));
                    content = content.replace(/-/g, '').trim();
                    const tokens = content.split(/\s+/);
                    const cleanTokens = tokens.filter(t => {
                        if (isNum(t) && parseNum(t) === amount) return false;
                        return true;
                    });
                    content = cleanTokens.join(' ');
                    if (content.trim()) noteParts.push(content.trim());
                });
                
                let note = noteParts.join(' ');
                
                if (note.includes('配息') || note.includes('轉入') || note.includes('存款息')) {
                    type = 'income';
                }
                
                let toAccountId = '';
                const detectedTransferId = detectTransferTarget(note);
                if (block.some(l => l.includes('提款'))) {
                     type = 'transfer';
                     const cashAcc = userAccounts.find(a => a.type === 'cash');
                     if(cashAcc) toAccountId = cashAcc.id;
                }
                
                if (detectedTransferId) {
                    if (type === 'expense') {
                        type = 'transfer';
                        toAccountId = detectedTransferId;
                    } else if (type === 'income') {
                         type = 'transfer';
                         toAccountId = targetAccountId; 
                    }
                }
                
                if (!note) note = "一般消費";
                
                const txObj = {
                    id: '', 
                    date: dateStr,
                    amount: amount,
                    note: note,
                    type: type,
                    categoryId: window.autoTag(note),
                    accountId: targetAccountId,
                    toAccountId: toAccountId, 
                    targetName: '', 
                    splits: []
                };

                if (type === 'transfer' && detectedTransferId && toAccountId === targetAccountId) {
                     txObj.accountId = detectedTransferId; 
                     txObj.toAccountId = targetAccountId; 
                }
                
                if (note.includes('國泰世華卡') || note.includes('信用卡款')) {
                     const ccAcc = userAccounts.find(a => a.name.includes('國泰') && a.type === 'credit');
                     if(ccAcc) {
                         txObj.type = 'transfer';
                         txObj.toAccountId = ccAcc.id;
                     }
                }

                parsed.push(txObj);

            } catch(e) { console.error("Block parse error", e); }
        }

        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            const isDateStart = dateRegexFull.test(line) || (dateRegexShort.test(line) && line.length < 50 && (line.includes('/') || line.includes('-')));
            if (isDateStart) {
                if (currentBlock.length > 0) processBlock(currentBlock);
                currentBlock = [line];
            } else {
                currentBlock.push(line);
            }
        }
        if (currentBlock.length > 0) processBlock(currentBlock);
        
        // Re-assign IDs
        const baseTime = Date.now();
        parsed.forEach((p, i) => { p.id = (baseTime + (parsed.length - i)).toString(); });

        setPreviewData(parsed);
    };

    const resetForm = () => { setNewTx({ amount: '', note: '', type: 'expense', categoryId: 'food_伙食', date: new Date().toISOString().split('T')[0], toAccountId: '', targetName: '', splits: [] }); setIsSplitMode(false); setSplitTotal(''); setSplits([]); setIsEditMode(false); setEditingTxId(null); };
    
    const saveTransaction = (txToSave, newDebtTargets) => {
        let updatedTransactions = [...data.transactions];
        let updatedDebtTargets = data.debtTargets || [];
        if(newDebtTargets) updatedDebtTargets = newDebtTargets;
        
        if (isSplitMode) {
             const total = parseFloat(splitTotal); 
             const safeSplits = (splits || []).filter(s => s.name && parseFloat(s.amount) > 0); 
             const splitSum = safeSplits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
             
             if (splitSum > total) { showToast('分帳金額不能超過總金額', 'error'); return; }

             const tx = { 
                 id: isEditMode ? editingTxId : Date.now().toString(), 
                 date: newTx.date, 
                 type: newTx.type, 
                 accountId: selectedAccount, 
                 amount: parseFloat(splitTotal), 
                 note: newTx.note, 
                 categoryId: newTx.categoryId, 
                 splits: safeSplits 
             };
             
             if(isEditMode) updatedTransactions = updatedTransactions.map(t => t.id === editingTxId ? tx : t);
             else updatedTransactions.push(tx);

        } else {
             if(!txToSave.amount) return;
             const txData = { ...txToSave, amount: parseFloat(txToSave.amount), accountId: selectedAccount, splits: [] }; 
             if(isEditMode) updatedTransactions = updatedTransactions.map(t => t.id === editingTxId ? { ...txData, id: editingTxId } : t); else updatedTransactions.push({ ...txData, id: Date.now().toString() });
        }
        saveData({ ...data, transactions: updatedTransactions, debtTargets: updatedDebtTargets }); setShowAdd(false); resetForm();
    };
    const handleDelete = () => { const updated = data.transactions.filter(t => t.id !== editingTxId); saveData({ ...data, transactions: updated }); setShowAdd(false); };
    
    // Batch Delete Logic
    const toggleSelectTx = (id) => {
        if (selectedTxIds.includes(id)) {
            setSelectedTxIds(selectedTxIds.filter(tid => tid !== id));
        } else {
            setSelectedTxIds([...selectedTxIds, id]);
        }
    };

    const toggleSelectAll = (filteredTxs) => {
        if (selectedTxIds.length === filteredTxs.length) {
            setSelectedTxIds([]);
        } else {
            setSelectedTxIds(filteredTxs.map(t => t.id));
        }
    };

    const confirmBatchDelete = () => {
        if (selectedTxIds.length > 0) {
            const updated = data.transactions.filter(t => !selectedTxIds.includes(t.id));
            saveData({ ...data, transactions: updated });
            setSelectedTxIds([]);
            setShowDeleteBatchConfirm(false);
            showToast('已刪除選取項目');
        }
    };

    const openEdit = (tx) => { 
        setNewTx({ ...tx, amount: tx.amount.toString() }); 
        if(tx.splits && tx.splits.length > 0) { 
            setIsSplitMode(true); 
            setSplitTotal(tx.amount.toString()); 
            setSplits(tx.splits); 
        } else { 
            setIsSplitMode(false); 
            setSplitTotal('');
            setSplits([]); 
        } 
        setIsEditMode(true); 
        setEditingTxId(tx.id); 
        setShowAdd(true); 
    };

    const getFilteredTransactions = () => { 
        const y = currentDate.getFullYear(); 
        const m = currentDate.getMonth(); 
        return data.transactions.filter(t => { 
            const d = new Date(t.date); 
            const isRelated = t.accountId === selectedAccount || t.toAccountId === selectedAccount; 
            return d.getFullYear() === y && d.getMonth() === m && isRelated; 
        }).sort((a, b) => {
            const dateDiff = new Date(b.date) - new Date(a.date);
            if (dateDiff !== 0) return dateDiff;
            if (b.id < a.id) return -1;
            if (b.id > a.id) return 1;
            return 0;
        }); 
    };

    const toggleSection = (key) => {
        if (expandedTypes.includes(key)) {
            setExpandedTypes(expandedTypes.filter(k => k !== key));
        } else {
            setExpandedTypes([...expandedTypes, key]);
        }
        window.refreshIcons();
    };

    if (selectedAccount) {
        const filteredTxs = getFilteredTransactions();
        const currentAccount = data.accounts.find(a => a.id === selectedAccount);
        return (
            <div className="pb-24 md:pb-0 animate-fade flex flex-col h-full relative">
                {/* Account Details Header & Controls */}
                <div className="flex justify-between items-center mb-6 px-4 md:px-0 pt-4">
                    {/* Simplified Header - Removing heavy styling */}
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSelectedAccount(null)} className="md:hidden p-2 -ml-2 rounded-full hover:bg-black/5"><i data-lucide="arrow-left" className="w-5 h-5 text-muji-text"></i></button>
                        <h3 className="text-2xl font-bold text-muji-text">{currentAccount?.name}</h3>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Month Picker */}
                        <div className="flex items-center bg-white border border-muji-border rounded-lg px-2 py-1">
                            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-muji-bg rounded"><i data-lucide="chevron-left" className="w-4 h-4"></i></button>
                            <span className="text-sm font-bold mx-2 cursor-pointer" onClick={() => setShowDatePicker(true)}>{currentDate.getMonth() + 1}月</span>
                            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-muji-bg rounded"><i data-lucide="chevron-right" className="w-4 h-4"></i></button>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                             <button onClick={() => { resetForm(); setShowAdd(true); }} className="bg-muji-accent text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1"><i data-lucide="plus" className="w-4 h-4"></i> 記帳</button>
                             <button onClick={() => { setImportText(''); setPreviewData([]); setShowImport(true); }} className="bg-white border border-muji-border text-muji-text px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm hover:bg-muji-bg flex items-center gap-1"><i data-lucide="sparkles" className="w-4 h-4"></i> AI</button>
                        </div>
                    </div>
                </div>

                {/* Batch Delete Bar */}
                {selectedTxIds.length > 0 && (
                     <div className="mb-4 flex justify-between items-center bg-muji-red/10 p-2 rounded-lg border border-muji-red/30 mx-4 md:mx-0">
                        <span className="text-xs text-muji-red font-bold ml-2">已選取 {selectedTxIds.length} 筆</span>
                        <button onClick={() => setShowDeleteBatchConfirm(true)} className="text-xs bg-muji-red text-white px-3 py-1.5 rounded font-bold hover:opacity-80">刪除</button>
                    </div>
                )}
                
                {/* Transaction List Container - Fixed Header Logic */}
                <div className="flex-1 overflow-y-auto bg-white mx-4 md:mx-0 mb-20 md:mb-0 rounded-xl border border-muji-border min-h-[50vh] max-h-[calc(100vh-250px)] relative flex flex-col">
                    {/* Separate Sticky Header */}
                    <div className="bg-muji-bg text-muji-muted font-medium border-b border-muji-border flex text-sm shadow-sm z-20 sticky top-0">
                        <div className="p-4 w-10 text-center flex-shrink-0 flex items-center justify-center">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 accent-muji-accent cursor-pointer"
                                checked={filteredTxs.length > 0 && selectedTxIds.length === filteredTxs.length}
                                onChange={() => toggleSelectAll(filteredTxs)}
                            />
                        </div>
                        <div className="p-4 text-center w-[15%] flex-shrink-0 flex items-center justify-center">日期</div>
                        <div className="p-4 text-center w-[10%] flex-shrink-0 flex items-center justify-center">類型</div>
                        <div className="p-4 text-center w-[20%] flex-shrink-0 flex items-center justify-center">類別/對象</div>
                        <div className="p-4 text-center w-[15%] flex-shrink-0 flex items-center justify-center">金額</div>
                        <div className="p-4 text-center w-[15%] flex-shrink-0 flex items-center justify-center">餘額</div>
                        <div className="p-4 text-center flex-1 flex items-center justify-center">備註</div>
                    </div>

                    {/* Scrollable Body - Remove overflow here as parent handles it */}
                    <div>
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <tbody className="divide-y divide-muji-border">
                                {filteredTxs.length === 0 ? <tr><td colSpan="7" className="text-center py-10 text-muji-muted">無紀錄</td></tr> : filteredTxs.map(tx => { 
                                    const cat = flatCategories[tx.categoryId] || { icon: 'help-circle', name: '未分類' }; 
                                    const txType = window.TX_TYPES[tx.type] || { label: '未知', color: 'text-gray-500' }; 
                                    let display = cat.name; 
                                    
                                    if(tx.type === 'transfer') { 
                                        const to = userAccounts.find(a=>a.id===tx.toAccountId); 
                                        const from = userAccounts.find(a=>a.id===tx.accountId);
                                        if (selectedAccount === tx.accountId) display = to ? `-> ${to.name}` : '轉出';
                                        else if (selectedAccount === tx.toAccountId) display = from ? `<- ${from.name}` : '轉入';
                                    } else if(tx.type === 'repay') display = tx.targetName || '-'; 
                                    
                                    const amountVal = tx.amount || 0;
                                    let splitInfo = "";
                                    let isSplit = false;
                                    if(tx.splits && tx.splits.length > 0) {
                                        const otherSplits = tx.splits.filter(s => s.owner !== 'me').reduce((a,c)=>a+(parseFloat(c.amount)||0),0);
                                        const myPart = amountVal - otherSplits;
                                        let others = tx.splits.filter(s => s.owner !== 'me').map(s => `${s.name}: $${(parseFloat(s.amount) || 0).toLocaleString()}`).join(', ');
                                        splitInfo = ` (我: $${myPart.toLocaleString()}${others ? ', ' + others : ''})`;
                                        if (tx.splits.length > 1 || otherSplits > 0) isSplit = true;
                                    }

                                    const textColorClass = tx.type === 'expense' ? 'text-rose-500' : (tx.type === 'income' ? 'text-emerald-500' : txType.color);
                                    let sign = '';
                                    if (tx.type === 'expense') sign = '-';
                                    else if (tx.type === 'income') sign = '+';
                                    else if (tx.type === 'transfer') sign = selectedAccount === tx.accountId ? '-' : '+';
                                    else if (tx.type === 'repay') sign = '+';

                                    const balance = balanceMap[tx.id];

                                    return (
                                        <tr key={tx.id} onClick={() => openEdit(tx)} className={`cursor-pointer flex w-full ${isSplit ? 'bg-orange-50/50 hover:bg-orange-100/50' : 'hover:bg-muji-hover'}`}>
                                            <td className="p-4 w-10 text-center flex-shrink-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 accent-muji-accent cursor-pointer"
                                                    checked={selectedTxIds.includes(tx.id)}
                                                    onChange={() => toggleSelectTx(tx.id)}
                                                />
                                            </td>
                                            <td className="p-4 text-center font-mono w-[15%] flex-shrink-0 flex items-center justify-center">{tx.date}</td>
                                            <td className={`p-4 text-center font-bold ${txType.color} w-[10%] flex-shrink-0 flex items-center justify-center`}>{txType.label}</td>
                                            <td className="p-4 text-center w-[20%] flex-shrink-0 flex items-center justify-center gap-2">{(tx.type==='expense'||tx.type==='income')&&<i data-lucide={cat.icon || 'circle'} className="w-4 h-4"></i>}<span className="truncate">{display}</span></td>
                                            <td className={`p-4 text-right font-mono font-bold ${textColorClass} w-[15%] flex-shrink-0 flex flex-col justify-center`}>
                                                <span>{sign}${amountVal.toLocaleString()}</span>
                                                <span className="text-xs text-muji-muted block">{splitInfo}</span>
                                            </td>
                                            <td className={`p-4 text-right font-mono font-bold w-[15%] flex-shrink-0 flex items-center justify-end ${balance < 0 ? 'text-rose-500' : 'text-muji-muted'}`}>
                                                {balance !== undefined ? `$${balance.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="p-4 text-left text-muji-muted truncate flex-1 flex items-center">{tx.note}</td>
                                        </tr>
                                    ) 
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                {/* Year-Month Picker Modal */}
                {showDatePicker && (
                    <window.Modal title="選擇日期" onClose={() => setShowDatePicker(false)}>
                        <div className="p-4">
                            <div className="flex justify-between items-center mb-4 px-2">
                                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1))} className="p-2 hover:bg-muji-bg rounded-full"><i data-lucide="chevron-left" className="w-5 h-5"></i></button>
                                <span className="text-xl font-bold font-mono">{currentDate.getFullYear()}</span>
                                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1))} className="p-2 hover:bg-muji-bg rounded-full"><i data-lucide="chevron-right" className="w-5 h-5"></i></button>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {Array.from({length: 12}, (_, i) => i).map(m => (
                                    <button 
                                        key={m} 
                                        onClick={() => { setCurrentDate(new Date(currentDate.getFullYear(), m, 1)); setShowDatePicker(false); }} 
                                        className={`py-3 rounded-lg text-sm font-bold transition-colors ${currentDate.getMonth() === m ? 'bg-muji-accent text-white shadow-md' : 'bg-muji-bg text-muji-text hover:bg-gray-200'}`}
                                    >
                                        {m+1}月
                                    </button>
                                ))}
                            </div>
                        </div>
                    </window.Modal>
                )}

                {/* Batch Delete Confirm Modal */}
                {showDeleteBatchConfirm && (
                    <window.Modal title="刪除確認" onClose={() => setShowDeleteBatchConfirm(false)}>
                        <div className="p-4 text-center space-y-4">
                            <p className="text-muji-text">確定要刪除選取的 <span className="font-bold">{selectedTxIds.length}</span> 筆資料嗎？</p>
                            <p className="text-xs text-muji-red">此操作無法復原！</p>
                            <div className="flex gap-3">
                                <button onClick={() => setShowDeleteBatchConfirm(false)} className="flex-1 py-3 border border-muji-border rounded-lg">取消</button>
                                <button onClick={confirmBatchDelete} className="flex-1 py-3 bg-muji-red text-white font-bold rounded-lg shadow-sm">確認刪除</button>
                            </div>
                        </div>
                    </window.Modal>
                )}

                {showImport && <window.SmartImportModal onClose={() => setShowImport(false)} importText={importText} setImportText={setImportText} previewData={previewData} setPreviewData={setPreviewData} saveData={saveData} data={data} handleSmartImport={handleSmartImport} flatCategories={flatCategories} userAccounts={userAccounts} selectedAccount={selectedAccount} />}
                {showAdd && <window.TransactionModal onClose={() => setShowAdd(false)} isEditMode={isEditMode} newTx={newTx} setNewTx={setNewTx} isSplitMode={isSplitMode} setIsSplitMode={setIsSplitMode} splitTotal={splitTotal} setSplitTotal={setSplitTotal} splits={splits} setSplits={setSplits} categoryGroups={categoryGroups} flatCategories={flatCategories} userAccounts={userAccounts} selectedAccount={selectedAccount} saveTransaction={saveTransaction} handleDeleteTransaction={handleDelete} data={data} saveData={saveData} />}
            </div>
        );
    }
    
    // Account List View
    const accounts = getCurrentUserAccounts();
    const accountTypes = data.settings?.accountTypes || window.DEFAULT_ACCOUNT_TYPES;
    const recentAccounts = getRecentAccounts();

    return (
        <div className="p-6 md:p-10 animate-fade relative min-h-full">
             {/* Sticky Header for Account List */}
             <div className="sticky top-0 z-10 bg-muji-bg flex justify-between items-center py-4 mb-6 -mt-6 -mx-6 px-6 md:-mt-10 md:-mx-10 md:px-10 border-b border-muji-border/50 backdrop-blur-sm bg-muji-bg/95">
                <h3 className="text-2xl font-bold text-muji-text">我的帳戶</h3>
                <button 
                    onClick={() => setInputModal({ show: true, title: '新增帳戶', value: '', value2: '', type: 'add_account' })} 
                    className="bg-muji-card border border-muji-border hover:border-muji-accent text-muji-text hover:text-muji-accent px-4 py-2 rounded-lg transition flex items-center gap-2 font-bold shadow-sm"
                >
                    <i data-lucide="plus" className="w-4 h-4"></i> 新增帳戶
                </button>
             </div>
             
             {/* Recent Accounts */}
             {recentAccounts.length > 0 && (
                 <div className="mb-6">
                    <button 
                        onClick={() => toggleSection('recent')}
                        className="w-full text-left flex items-center gap-2 mb-3 pb-1 border-b border-muji-border"
                    >
                        <i data-lucide={expandedTypes.includes('recent') ? "chevron-down" : "chevron-right"} className="w-4 h-4 text-muji-muted"></i>
                        <h4 className="text-muji-muted text-sm font-bold flex items-center gap-2">
                             <i data-lucide="clock" className="w-4 h-4"></i> 最近記帳
                        </h4>
                    </button>
                    {expandedTypes.includes('recent') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade">
                            {recentAccounts.map(acc => { 
                                const bal = window.calculateBalance(data, acc.id);
                                const isPositive = bal >= 0;
                                const typeConfig = accountTypes[acc.type] || { icon: 'circle-help' };
                                return (
                                    <div key={'recent_' + acc.id} onClick={() => setSelectedAccount(acc.id)} className="bg-white p-4 rounded-xl border border-muji-border hover:border-muji-accent hover:shadow-md transition-all cursor-pointer relative group h-32 flex flex-col justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full border-2 border-muji-text/20 flex items-center justify-center text-muji-text text-xl">
                                                <i data-lucide={typeConfig.icon} className="w-5 h-5"></i>
                                            </div>
                                            <div className="font-bold text-base text-muji-text truncate">{acc.name}</div>
                                        </div>
                                        <div className={`text-xl font-mono font-bold ${isPositive ? 'text-muji-green' : 'text-rose-500'}`}>${bal.toLocaleString()}</div>
                                    </div>
                                ); 
                            })}
                        </div>
                    )}
                 </div>
             )}

            {Object.entries(accountTypes).map(([typeKey, typeConfig]) => {
                const typeAccounts = accounts.filter(a => a.type === typeKey);
                if (typeAccounts.length === 0) return null;
                const isExpanded = expandedTypes.includes(typeKey);
                
                return (
                    <div key={typeKey} className="mb-6">
                        <button 
                            onClick={() => toggleSection(typeKey)}
                            className="w-full text-left flex items-center gap-2 mb-3 pb-1 border-b border-muji-border"
                        >
                            <i data-lucide={isExpanded ? "chevron-down" : "chevron-right"} className="w-4 h-4 text-muji-muted"></i>
                            <h4 className="text-muji-muted text-sm font-bold flex items-center gap-2">
                                <i data-lucide={typeConfig.icon} className="w-4 h-4"></i> {typeConfig.label}
                            </h4>
                        </button>
                        
                        {isExpanded && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade">
                                {typeAccounts.map(acc => { 
                                    const bal = window.calculateBalance(data, acc.id); 
                                    const isPositive = bal >= 0;
                                    return (
                                        <div key={acc.id} onClick={() => setSelectedAccount(acc.id)} className="bg-white p-4 rounded-xl border border-muji-border hover:border-muji-accent hover:shadow-md transition-all cursor-pointer relative group h-32 flex flex-col justify-between">
                                            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-2">
                                                <button onClick={(e) => {e.stopPropagation(); setInputModal({ show: true, title: '餘額校正', value: '', value2: '', type: 'calibrate_account', data: acc.id, extra: bal });}} className="p-1 hover:bg-muji-bg rounded text-muji-muted hover:text-muji-accent">
                                                    <i data-lucide="sliders-horizontal" className="w-3 h-3"></i>
                                                </button>
                                                <button onClick={(e) => {e.stopPropagation(); setInputModal({ show: true, title: '修改帳戶', value: acc.name, value2: acc.balance || 0, type: 'edit_account', data: acc.id, extra: acc.type });}} className="p-1 hover:bg-muji-bg rounded text-muji-muted hover:text-muji-accent">
                                                    <i data-lucide="pencil" className="w-3 h-3"></i>
                                                </button>
                                                <button onClick={(e) => {e.stopPropagation(); setInputModal({ show: true, title: '刪除', value: '確認', type: 'delete_account', data: acc.id });}} className="p-1 hover:bg-muji-bg rounded text-muji-muted hover:text-muji-red">
                                                    <i data-lucide="trash-2" className="w-3 h-3"></i>
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full border-2 border-muji-text/20 flex items-center justify-center text-muji-text text-xl">
                                                    <i data-lucide={typeConfig.icon} className="w-5 h-5"></i>
                                                </div>
                                                <div className="font-bold text-base text-muji-text truncate">{acc.name}</div>
                                            </div>
                                            {/* Updated color logic: Positive Green, Negative Red */}
                                            <div className={`text-xl font-mono font-bold ${isPositive ? 'text-muji-green' : 'text-rose-500'}`}>${bal.toLocaleString()}</div>
                                        </div>
                                    ); 
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};