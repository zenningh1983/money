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

const ExtraFieldsInput = ({ type, toAccountId, targetName, userAccounts, selectedAccount, onChange, debtTargets, onAddTarget }) => {
    if (type === 'transfer') {
        return (
            <div className="flex flex-col gap-1 mt-1 w-full">
                <label className="text-xs text-muji-muted">轉入帳戶</label>
                <select className="p-2 bg-muji-card rounded border border-muji-border text-sm w-full text-muji-text" value={toAccountId} onChange={e => onChange('toAccountId', e.target.value)}>
                    <option value="">選擇帳戶</option>
                    {userAccounts.filter(a => a.id !== selectedAccount).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
            </div>
        );
    }
    return null;
};

const SplitSection = ({ amount, splits, setSplits, debtTargets, onAddTarget, flatCategories, isWithOthersMode }) => {
    const totalAmount = parseFloat(amount) || 0;
    const safeSplits = Array.isArray(splits) ? splits : [];
    
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
                {safeSplits.map((s, idx) => (
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
                            <select 
                                className="flex-1 p-1.5 bg-muji-bg rounded border border-muji-border text-xs text-muji-text" 
                                value={s.categoryId} 
                                onChange={e => updateSplit(idx, 'categoryId', e.target.value)}
                            >
                                 {Object.entries(flatCategories).filter(([_, cat]) => cat.type === 'expense').map(([id, cat]) => (
                                     <option key={id} value={id}>{cat.group} - {cat.name}</option>
                                 ))}
                            </select>
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
                ))}
            </div>
            <button onClick={addSplit} className="w-full py-2 border border-dashed border-muji-accent text-muji-accent text-xs rounded hover:bg-white transition-colors flex items-center justify-center gap-1 mt-3"><i data-lucide="plus" className="w-3 h-3"></i> 新增明細 (分帳/多類別)</button>
        </div>
    );
};

window.SmartImportModal = ({ onClose, importText, setImportText, previewData, setPreviewData, saveData, data, handleSmartImport, flatCategories, userAccounts, selectedAccount }) => {
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [editingPreviewIndex, setEditingPreviewIndex] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState('food');
    const [targetAccountId, setTargetAccountId] = useState(selectedAccount || (userAccounts.length > 0 ? userAccounts[0].id : ''));
    
    useEffect(() => { window.refreshIcons(); }, [showCategoryPicker, previewData]);

    const doSmartImport = () => {
        handleSmartImport(targetAccountId);
    };

    return (
        <window.Modal title="AI 記帳" onClose={onClose}>
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
                                    <div key={idx} className="flex flex-col gap-2 p-3 bg-muji-card rounded-lg text-sm border border-muji-border shadow-sm">
                                        <div className="flex justify-between items-center gap-2">
                                            <input type="date" aria-label="交易日期" className="bg-transparent border-b border-muji-border focus:border-muji-accent outline-none font-mono text-muji-text w-28 text-xs" value={item.date} onChange={(e) => { const n = [...previewData]; n[idx].date = e.target.value; setPreviewData(n); }} />
                                            <select aria-label="交易類型" className={`bg-transparent font-bold outline-none cursor-pointer text-xs flex-1 ${window.TX_TYPES[item.type]?.color || 'text-muji-text'}`} value={item.type} onChange={(e) => { const n = [...previewData]; n[idx].type = e.target.value; n[idx].toAccountId = ''; n[idx].targetName = ''; setPreviewData(n); }}>{Object.entries(window.TX_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                                            <div className="flex items-center gap-1"><input type="number" aria-label="金額" className="bg-transparent font-bold font-mono outline-none w-20 text-right border-b border-muji-border focus:border-muji-accent text-muji-text" value={item.amount} onChange={(e) => { const n = [...previewData]; n[idx].amount = parseFloat(e.target.value); setPreviewData(n); }} /></div>
                                            <button aria-label="刪除" onClick={() => setPreviewData(previewData.filter((_, i) => i !== idx))} className="text-muji-muted hover:text-muji-red"><i data-lucide="trash-2" className="w-4 h-4"></i></button>
                                        </div>
                                        <div className="flex items-center gap-2"><span className="text-xs text-muji-muted whitespace-nowrap">帳戶:</span><select aria-label="帳戶" className="bg-transparent text-xs border-b border-muji-muted/30 focus:border-muji-accent outline-none flex-1 text-muji-text" value={item.accountId} onChange={(e) => { const n = [...previewData]; n[idx].accountId = e.target.value; setPreviewData(n); }}>{userAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}</select></div>
                                        <div className="flex items-center gap-2">{(item.type === 'expense' || item.type === 'income') && (<button onClick={() => { setEditingPreviewIndex(idx); setShowCategoryPicker(true); }} className="flex-1 text-left px-2 py-1.5 rounded bg-white border border-muji-border text-xs flex items-center gap-2 hover:border-muji-accent text-muji-text"><i data-lucide={flatCategories[item.categoryId]?.icon || 'tag'} className="w-3 h-3"></i>{flatCategories[item.categoryId]?.name || '選擇分類'}</button>)}<ExtraFieldsInput type={item.type} toAccountId={item.toAccountId} targetName={item.targetName} userAccounts={userAccounts} selectedAccount={item.accountId} onChange={(k, v) => { const n = [...previewData]; n[idx][k] = v; setPreviewData(n); }} debtTargets={data.debtTargets} onAddTarget={() => {}} /></div>
                                        <input type="text" aria-label="備註" className="w-full bg-transparent border-b border-muji-border focus:border-muji-accent outline-none text-muji-text text-xs placeholder-muji-muted" placeholder="備註..." value={item.note} onChange={(e) => { const n = [...previewData]; n[idx].note = e.target.value; setPreviewData(n); }} />
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2 pt-2"><button onClick={() => setPreviewData([])} className="flex-1 py-3 bg-white text-muji-text rounded-lg font-bold border border-muji-border">放棄</button><button onClick={() => { saveData({...data, transactions: [...data.transactions, ...previewData], debtTargets: data.debtTargets }); setPreviewData([]); onClose(); }} className="flex-[2] py-3 bg-muji-accent text-white rounded-lg font-bold shadow-sm">確認匯入 ({previewData.length})</button></div>
                        </>
                    ) : (
                        <div className="animate-fade">
                            <div className="flex justify-between items-center mb-4"><h4 className="font-bold text-muji-text">選擇分類</h4><button onClick={() => setShowCategoryPicker(false)} className="text-muji-muted">取消</button></div>
                            <CategorySelector type={previewData[editingPreviewIndex].type} categoryGroups={window.DEFAULT_CATEGORY_GROUPS} selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup} onSelectCategory={(catId) => { const n = [...previewData]; n[editingPreviewIndex].categoryId = catId; setPreviewData(n); setShowCategoryPicker(false); }} currentCategory={previewData[editingPreviewIndex].categoryId} />
                        </div>
                    )}
                </div>
            )}
        </window.Modal>
    );
};

window.TransactionModal = ({ onClose, isEditMode, newTx, setNewTx, isSplitMode, setIsSplitMode, splitTotal, setSplitTotal, splits, setSplits, categoryGroups, flatCategories, userAccounts, selectedAccount, saveTransaction, handleDeleteTransaction, data, saveData }) => {
    const [selectedGroup, setSelectedGroup] = useState(flatCategories[newTx.categoryId]?.group || 'food');
    const [showBalanceConfirm, setShowBalanceConfirm] = useState(false);
    const [pendingBalanceDiff, setPendingBalanceDiff] = useState(0);
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
                 // Trigger custom confirm modal
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

    const handleConfirmBalance = () => {
        // Auto-assign balance to 'Me'
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
    
    return (
        <window.Modal title={isEditMode ? "編輯交易" : "記一筆"} onClose={onClose}>
            <div className="space-y-4">
                <div className="flex justify-between items-center overflow-x-auto no-scrollbar pb-2">
                    <div className="flex bg-muji-bg rounded-lg p-1">
                        {Object.entries(window.TX_TYPES).map(([k, v]) => (
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
                        ))}
                    </div>
                    
                    {newTx.type === 'expense' && (
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
                            toAccountId={newTx.toAccountId} 
                            targetName={newTx.targetName} 
                            userAccounts={userAccounts} 
                            selectedAccount={selectedAccount} 
                            onChange={(k, v) => setNewTx({...newTx, [k]: v})} 
                            debtTargets={debtTargets} 
                            onAddTarget={() => {}} 
                        />
                    </>
                )}
                
                <div className="flex gap-2 mt-4">
                    <input type="date" className="flex-1 p-3 bg-muji-card rounded-lg text-muji-text border border-muji-border" value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} />
                    <input type="text" className="flex-[2] p-3 bg-muji-card rounded-lg text-muji-text border border-muji-border" placeholder="備註" value={newTx.note} onChange={e => setNewTx({...newTx, note: e.target.value})} />
                </div>

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
        </window.Modal>
    );
};

window.AccountingView = ({ data, saveData, selectedAccount, setSelectedAccount, setInputModal, showToast }) => {
    const [showImport, setShowImport] = useState(false); const [importText, setImportText] = useState(''); const [previewData, setPreviewData] = useState([]);
    const [showAdd, setShowAdd] = useState(false); const [isEditMode, setIsEditMode] = useState(false); const [editingTxId, setEditingTxId] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date()); const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSplitMode, setIsSplitMode] = useState(false); const [splitTotal, setSplitTotal] = useState(''); const [splits, setSplits] = useState([]);
    const [newTx, setNewTx] = useState({ amount: '', note: '', type: 'expense', categoryId: 'food_伙食', date: new Date().toISOString().split('T')[0], toAccountId: '', targetName: '', splits: [] });

    const categoryGroups = data.settings?.categoryGroups || window.DEFAULT_CATEGORY_GROUPS;
    const flatCategories = useMemo(() => window.getFlatCategories(categoryGroups), [categoryGroups]);
    
    useEffect(() => { if (window.lucide && (showAdd || showImport || showDatePicker)) setTimeout(() => window.lucide.createIcons(), 50); }, [showAdd, isEditMode, showImport, previewData, showDatePicker]);

    const getCurrentUserAccounts = () => data.accounts.filter(a => a.userId === data.currentUser || (!a.userId && data.currentUser === 'default'));
    const userAccounts = getCurrentUserAccounts();

    const handleSmartImport = (targetAccountId) => {
        const rawLines = importText.split('\n').map(l => l.trim()).filter(l => l);
        const parsed = [];
        const currentYear = new Date().getFullYear();
        const parseNum = (str) => parseFloat(str.replace(/,/g, ''));
        const isNum = (str) => /^\d{1,3}(,\d{3})*(\.\d+)?$/.test(str);
        
        // --- 混合區塊模式 (Mixed Block Mode) ---
        // 策略：以「日期」作為區塊分割點。
        // 只要遇到 YYYY/MM/DD 或 MM/DD，就視為一筆新交易的開始。
        // 然後在該區塊內搜尋金額、關鍵字、備註。
        
        const dateRegexFull = /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/; // YYYY/MM/DD
        const dateRegexShort = /^(\d{1,2})[\/\-\.](\d{1,2})/; // MM/DD
        
        let currentBlock = [];
        
        const processMixedBlock = (block) => {
            if (block.length === 0) return;
            try {
                // 1. 抓日期
                const dateLine = block[0]; // 區塊第一行必然包含日期
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

                // 2. 抓金額與類型 (使用 Token 分析法)
                let amount = 0;
                let type = 'expense';
                let foundAmount = false;
                
                for (let i = 0; i < block.length; i++) {
                    let content = block[i].replace(/−/g, '-').replace(/\t/g, ' ');
                    
                    // 分割成 Token
                    const tokens = content.split(/\s+/).filter(t => t.trim() !== '');
                    
                    // 掃描 Token 序列
                    for (let j = 0; j < tokens.length; j++) {
                        const token = tokens[j];
                        const nextToken = tokens[j+1];
                        
                        // 略過明顯的日期 (避免誤判)
                        if (token.includes('/') || token.includes(':')) continue;

                        if (isNum(token)) {
                            // 規則 1: [金額] [減號] -> 支出 (Withdrawal)
                            // 例子: "1,158" "-"
                            if (nextToken === '-') {
                                amount = parseNum(token);
                                type = 'expense';
                                foundAmount = true;
                                break;
                            }
                            
                            // 規則 2: 純數字行 (且不含其他雜訊) -> 可能是 Type 2 垂直格式
                            // 如果整行就只有這個數字，且還沒找到金額
                            if (tokens.length === 1 && !foundAmount) {
                                amount = parseNum(token);
                                type = 'expense'; // 預設支出
                                foundAmount = true;
                                // 不 break，繼續找是否有更明確的匹配? 不，純數字行通常就是金額。
                                break;
                            }
                            
                            // 規則 3: TWD [金額]
                            if (token.toUpperCase() === 'TWD' && isNum(nextToken)) {
                                amount = parseNum(nextToken);
                                type = 'expense';
                                foundAmount = true;
                                break;
                            }
                        } else if (token === '-') {
                            // 規則 4: [減號] [金額] -> 收入 (Deposit)
                            // 例子: "-" "1,158"
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

                // 3. 抓備註 (將剩餘文字串接)
                let noteParts = [];
                block.forEach((line, i) => {
                    let content = line.replace(/−/g, '-').replace(/\t/g, ' ');
                    // 移除已提取的日期 (只移除第一行的日期)
                    if (i === 0 && dateMatch) content = content.replace(dateMatch[0], '');
                    
                    // 移除特定雜訊關鍵字
                    const noise = ['網銀轉帳', '信用卡款', '電子轉出', '跨行提款', '交易資訊', '備註', '說明', 'TWD', 'TW', '新臺幣金額', '交易說明'];
                    noise.forEach(n => content = content.replace(n, ''));
                    
                    // 移除無意義符號
                    content = content.replace(/-/g, '').trim();
                    
                    // 移除我們剛剛找到的金額 (避免重複出現在備註)
                    // 這比較難精準，簡單起見，我們移除符合金額格式且數值等於 amount 的字串
                    const tokens = content.split(/\s+/);
                    const cleanTokens = tokens.filter(t => {
                        if (isNum(t) && parseNum(t) === amount) return false;
                        return true;
                    });
                    content = cleanTokens.join(' ');

                    if (content.trim()) noteParts.push(content.trim());
                });
                
                let note = noteParts.join(' ');
                
                // 補回關鍵字到備註開頭 (如果原始區塊有)
                const typeKeywords = ['網銀轉帳', '信用卡款', '電子轉出', '跨行提款', '餐飲', '全聯', '7-11'];
                for(const kw of typeKeywords) {
                    if (block.some(l => l.includes(kw))) {
                        // 避免重複添加
                        if (!note.includes(kw)) {
                            note = (kw + ' ' + note).trim();
                        }
                        break;
                    }
                }
                
                if (!note) note = "一般消費";

                parsed.push({
                    id: Date.now() + Math.random(),
                    date: dateStr,
                    amount: amount,
                    note: note,
                    type: type,
                    categoryId: window.autoTag(note),
                    accountId: targetAccountId,
                    toAccountId: '', targetName: '', splits: []
                });

            } catch(e) { console.error("Block parse error", e); }
        };

        // 執行區塊掃描
        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            // 判斷是否為新區塊的開始：必須是日期開頭
            const isDateStart = dateRegexFull.test(line) || (dateRegexShort.test(line) && line.length < 50 && (line.includes('/') || line.includes('-')));
            
            if (isDateStart) {
                if (currentBlock.length > 0) {
                    processMixedBlock(currentBlock);
                }
                currentBlock = [line];
            } else {
                currentBlock.push(line);
            }
        }
        if (currentBlock.length > 0) processMixedBlock(currentBlock);
        
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

    const getFilteredTransactions = () => { const y = currentDate.getFullYear(); const m = currentDate.getMonth(); return data.transactions.filter(t => { const d = new Date(t.date); const isRelated = t.accountId === selectedAccount || t.toAccountId === selectedAccount; return d.getFullYear() === y && d.getMonth() === m && isRelated; }).sort((a, b) => new Date(b.date) - new Date(a.date)); };

    if (selectedAccount) {
        const filteredTxs = getFilteredTransactions();
        const currentAccount = data.accounts.find(a => a.id === selectedAccount);
        return (
            <div className="pb-24 md:pb-0 animate-fade">
                <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 p-4 pt-10 rounded-t-xl">
                    <div className="text-center text-lg font-bold text-muji-text mb-4">{currentAccount?.name}</div>
                    <div className="flex justify-between items-center relative">
                        <button onClick={() => { resetForm(); setShowAdd(true); }} className="text-xs bg-muji-accent text-white px-3 py-2 rounded-lg font-bold shadow-sm hover:opacity-90 flex items-center gap-1"><i data-lucide="plus" className="w-4 h-4"></i> 記一筆</button>
                        <div className="flex items-center justify-center gap-2 bg-white border border-muji-border rounded-lg p-1 max-w-xs mx-auto absolute left-1/2 transform -translate-x-1/2"><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-muji-bg rounded"><i data-lucide="chevron-left" className="w-4 h-4"></i></button><div className="font-bold text-muji-text font-serif cursor-pointer w-24 text-center text-sm" onClick={() => setShowDatePicker(true)}>{currentDate.getFullYear()} / {currentDate.getMonth() + 1}</div><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-muji-bg rounded"><i data-lucide="chevron-right" className="w-4 h-4"></i></button></div>
                        <button onClick={() => { setImportText(''); setPreviewData([]); setShowImport(true); }} className="text-xs bg-muji-accent text-white px-3 py-2 rounded-lg font-bold shadow-sm hover:opacity-90 flex items-center gap-1"><i data-lucide="sparkles" className="w-4 h-4"></i> AI 記帳</button>
                    </div>
                </div>
                <div className="overflow-x-auto bg-white mx-4 md:mx-6 mb-20 md:mb-0 rounded-xl border border-muji-border">
                    <table className="w-full text-left text-sm whitespace-nowrap"><thead className="bg-muji-bg text-muji-muted font-medium sticky top-0 z-10"><tr><th className="p-4 text-center w-[15%]">日期</th><th className="p-4 text-center w-[10%]">類型</th><th className="p-4 text-center w-[20%]">類別/對象</th><th className="p-4 text-center w-[20%]">金額</th><th className="p-4 text-center w-[35%]">備註</th></tr></thead><tbody className="divide-y divide-muji-border">{filteredTxs.length === 0 ? <tr><td colSpan="5" className="text-center py-10 text-muji-muted">無紀錄</td></tr> : filteredTxs.map(tx => { 
                        const cat = flatCategories[tx.categoryId] || { icon: 'help-circle', name: '未分類' }; 
                        const txType = window.TX_TYPES[tx.type] || { label: '未知', color: 'text-gray-500' }; 
                        let display = cat.name; 
                        if(tx.type === 'transfer') { const to = userAccounts.find(a=>a.id===tx.toAccountId); display = to ? `-> ${to.name}` : '轉帳'; } 
                        else if(tx.type === 'repay') display = tx.targetName || '-'; 
                        
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

                        return (<tr key={tx.id} onClick={() => openEdit(tx)} className={`cursor-pointer ${isSplit ? 'bg-orange-50/50 hover:bg-orange-100/50' : 'hover:bg-muji-hover'}`}><td className="p-4 text-center font-mono">{tx.date}</td><td className={`p-4 text-center font-bold ${txType.color}`}>{txType.label}</td><td className="p-4 text-center flex justify-center items-center gap-2">{(tx.type==='expense'||tx.type==='income')&&<i data-lucide={cat.icon || 'circle'} className="w-4 h-4"></i>}{display}</td><td className={`p-4 text-right font-mono font-bold ${txType.color}`}>{tx.type==='income'||tx.type==='repay'?'+':'-'}${amountVal.toLocaleString()}<span className="text-xs text-muji-muted block">{splitInfo}</span></td><td className="p-4 text-left text-muji-muted truncate max-w-[150px]">{tx.note}</td></tr>) })}</tbody></table>
                </div>
                <button onClick={() => { resetForm(); setShowAdd(true); }} className="fixed bottom-24 md:bottom-10 right-6 md:right-10 w-14 h-14 bg-muji-accent text-white rounded-full shadow-lg flex items-center justify-center z-20"><i data-lucide="plus" className="w-8 h-8"></i></button>
                {showDatePicker && <window.Modal title="選擇日期" onClose={() => setShowDatePicker(false)}><div className="grid grid-cols-4 gap-2 p-4">{Array.from({length: 12}, (_, i) => i).map(m => (<button key={m} onClick={() => { setCurrentDate(new Date(currentDate.getFullYear(), m, 1)); setShowDatePicker(false); }} className={`py-3 rounded-lg text-sm font-bold ${currentDate.getMonth() === m ? 'bg-muji-accent text-white' : 'bg-muji-bg text-muji-text'}`}>{m+1}月</button>))}</div></window.Modal>}
                {showImport && <window.SmartImportModal onClose={() => setShowImport(false)} importText={importText} setImportText={setImportText} previewData={previewData} setPreviewData={setPreviewData} saveData={saveData} data={data} handleSmartImport={handleSmartImport} flatCategories={flatCategories} userAccounts={userAccounts} selectedAccount={selectedAccount} />}
                {showAdd && <window.TransactionModal onClose={() => setShowAdd(false)} isEditMode={isEditMode} newTx={newTx} setNewTx={setNewTx} isSplitMode={isSplitMode} setIsSplitMode={setIsSplitMode} splitTotal={splitTotal} setSplitTotal={setSplitTotal} splits={splits} setSplits={setSplits} categoryGroups={categoryGroups} flatCategories={flatCategories} userAccounts={userAccounts} selectedAccount={selectedAccount} saveTransaction={saveTransaction} handleDeleteTransaction={handleDelete} data={data} saveData={saveData} />}
            </div>
        );
    }
    
    // 如果沒有 selectedAccount，顯示帳戶列表（這是修復的關鍵）
    const accounts = getCurrentUserAccounts();
    const accountTypes = data.settings?.accountTypes || window.DEFAULT_ACCOUNT_TYPES;
    return (
        <div className="p-6 md:p-10 animate-fade">
             <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-bold text-muji-text">我的帳戶</h3><button onClick={() => setInputModal({ show: true, title: '新增帳戶', value: '', type: 'add_account' })} className="text-muji-accent hover:bg-muji-bg px-3 py-2 rounded-lg transition">+ 新增</button></div>
            {Object.entries(accountTypes).map(([typeKey, typeConfig]) => {
                const typeAccounts = accounts.filter(a => a.type === typeKey);
                if (typeAccounts.length === 0) return null;
                return (
                    <div key={typeKey} className="mb-6">
                        <h4 className="text-muji-muted text-sm font-bold mb-3 border-b border-muji-border pb-1 flex items-center gap-2">
                            <i data-lucide={typeConfig.icon} className="w-4 h-4"></i> {typeConfig.label}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {typeAccounts.map(acc => { 
                                const bal = window.calculateBalance(data, acc.id); 
                                return (
                                    <div key={acc.id} onClick={() => setSelectedAccount(acc.id)} className="bg-white p-4 rounded-xl border border-muji-border hover:border-muji-accent hover:shadow-md transition-all cursor-pointer relative group">
                                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-2">
                                            <button onClick={(e) => {e.stopPropagation(); setInputModal({ show: true, title: '修改', value: acc.name, type: 'rename_account', data: acc.id, extra: acc.type });}} className="p-1 hover:bg-muji-bg rounded">
                                                <i data-lucide="pencil" className="w-3 h-3"></i>
                                            </button>
                                            <button onClick={(e) => {e.stopPropagation(); setInputModal({ show: true, title: '刪除', value: '確認', type: 'delete_account', data: acc.id });}} className="p-1 hover:bg-muji-bg rounded">
                                                <i data-lucide="trash-2" className="w-3 h-3 text-muji-red"></i>
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-full border-2 border-muji-text/20 flex items-center justify-center text-muji-text text-xl">
                                                <i data-lucide={typeConfig.icon} className="w-5 h-5"></i>
                                            </div>
                                            <div className="font-bold text-base text-muji-text truncate">{acc.name}</div>
                                        </div>
                                        <div className={`text-xl font-mono font-bold ${bal < 0 ? 'text-muji-red' : 'text-muji-text'}`}>${bal.toLocaleString()}</div>
                                    </div>
                                ); 
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};