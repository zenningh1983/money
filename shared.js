const { useState, useEffect, useRef, useMemo, useCallback } = React;

// --- 1. CONSTANTS (Exported to window for cross-file use) ---
window.DEFAULT_REPO = "zenningh1983/money";
window.FILE_PATH = "money_data.json";
window.DEFAULT_TOKEN_SUFFIX = "hfFz2uYiriKFcVZlrD3YU79KRTdBvf0yd7PA"; 

window.DEFAULT_ACCOUNT_TYPES = {
    cash: { label: '現金', icon: 'banknote' }, 
    bank: { label: '銀行', icon: 'landmark' },
    credit: { label: '信用卡', icon: 'credit-card' },
    ticket: { label: '電子票卡', icon: 'ticket' }
};

window.TX_TYPES = {
    expense: { label: '支出', color: 'text-muji-text', icon: 'minus' },
    income: { label: '收入', color: 'text-muji-green', icon: 'plus' },
    transfer: { label: '轉帳', color: 'text-muji-blue', icon: 'arrow-right-left' },
    repay: { label: '還款', color: 'text-teal-600', icon: 'undo-2' }
};

window.DEFAULT_CATEGORY_GROUPS = {
    expense: [
        { id: 'food', label: '伙食', icon: 'utensils', subs: ['三餐', '交際應酬', '酒類', '咖啡飲料', '水果', '零食', '超市'] },
        { id: 'transport', label: '交通', icon: 'bus', subs: ['公車捷運', 'Gogoro', '高鐵台鐵', '租車', '計程車', '加油', '停車', '洗車', '維修保養'] },
        { id: 'home', label: '居家', icon: 'home', subs: ['房貸', '管理費', '水電瓦斯', '網路', '手機費', '傢俱家電', '日用雜貨', '3C 周邊', '修繕'] },
        { id: 'life', label: '生活', icon: 'shopping-bag', subs: ['治裝', '美容美妝', '美髮', '美甲', '美睫'] },        
        { id: 'play', label: '娛樂', icon: 'gamepad-2', subs: ['電影', '唱歌', '棒球', '泡湯按摩', '植栽', '旅行', 'APP訂閱', '遊戲課金', '打牌博弈'] },
        { id: 'medical', label: '醫療', icon: 'stethoscope', subs: ['掛號費', '藥用品', '保健食品', '健檢', '疫苗', '住院手術'] },
        { id: 'insurance', label: '保險稅負', icon: 'shield', subs: ['一般保險', '車險', '旅遊險', '各式稅金'] },
        { id: 'parenting', label: '育兒', icon: 'baby', subs: ['學雜費', '補習班', '安親班', '才藝', '冬夏令營', '零用錢', '小孩物品', '小孩治裝', '學用品'] },
        { id: 'invest', label: '投資理財', icon: 'piggy-bank', subs: ['個股', 'ETF', '基金', '定存', '外幣'] },
        { id: 'other', label: '其他', icon: 'circle-ellipsis', subs: ['手續費', '滯納金', '運費', '人情紅包', '禮物', '捐款', '請客', '罰單', '遺失', '其他'] }
    ],
    income: [
        { id: 'active', label: '主動', icon: 'briefcase', subs: ['薪資', '加班費', '獎金'] },
        { id: 'passive', label: '被動', icon: 'trending-up', subs: ['股息', '利息', '贖回'] },
        { id: 'other_in', label: '其他', icon: 'wallet', subs: ['紅包', '退款', '補助款', '中獎', '紅利回饋','其他'] }
    ]
};

window.DEFAULT_DEBT_TARGETS = [
    { id: 'dt_1', name: '朋友A', defaultPercent: 50 },
    { id: 'dt_2', name: '公司', defaultPercent: 100 },
    { id: 'dt_3', name: '家人', defaultPercent: '' }
];

window.INITIAL_DATA = {
    users: [{ id: 'default', name: '預設帳本' }],
    currentUser: 'default',
    accounts: [
        { id: 'acc1', name: '我的錢包', type: 'cash', balance: 0, userId: 'default' },
        { id: 'acc2', name: '薪資帳戶', type: 'bank', balance: 0, userId: 'default' },
    ],
    transactions: [],
    stocks: [],
    stockTransactions: [],
    settings: { categoryGroups: window.DEFAULT_CATEGORY_GROUPS, accountTypes: window.DEFAULT_ACCOUNT_TYPES },
    debtTargets: window.DEFAULT_DEBT_TARGETS
};

window.KEYWORD_MAPPING = {
    '早餐': 'food_三餐', '午餐': 'food_三餐', '晚餐': 'food_三餐', '便當': 'food_三餐', '三餐': 'food_三餐',
    'ＱＢｕｒｇｅｒ': 'food_三餐', 'QBurger': 'food_三餐', '統一': 'food_三餐', '餐飲': 'food_三餐', '食堂': 'food_三餐',
    '飲料': 'food_咖啡飲料', '咖啡': 'food_咖啡飲料', '星巴克': 'food_咖啡飲料', '路易莎': 'food_咖啡飲料',
    '全聯': 'food_超市', '家樂福': 'food_超市', '大潤發': 'food_超市', 'Costco': 'food_超市', '好市多': 'food_超市', '全聯小時達': 'food_超市',
    '7-11': 'food_零食', '全家': 'food_零食', '萊爾富': 'food_零食', 'OK': 'food_零食',
    '捷運': 'transport_公車捷運', '公車': 'transport_公車捷運', '客運': 'transport_公車捷運', '高鐵': 'transport_公車捷運', '台鐵': 'transport_高鐵台鐵',
    'Uber': 'transport_計程車', '計程車': 'transport_計程車', '55688': 'transport_計程車',
    '加油': 'transport_加油', '中油': 'transport_加油', '台塑': 'transport_加油',
    '停車': 'transport_停車', 'eTag': 'transport_停車',
    '房租': 'home_房貸', '水費': 'home_水電瓦斯', '電費': 'home_水電瓦斯', '瓦斯': 'home_水電瓦斯',
    '電信': 'home_手機費', '中華電信': 'home_手機費', '遠傳': 'home_手機費', '台灣大哥大': 'home_手機費',
    '屈臣氏': 'life_美容美妝', '康是美': 'life_美容美妝',
    '診所': 'medical_掛號費', '醫院': 'medical_掛號費', '掛號': 'medical_掛號費', '藥局': 'medical_藥用品',
    '保險': 'insurance_一般保險', '南山': 'insurance_一般保險', '國泰': 'insurance_一般保險', '富邦': 'insurance_一般保險',
    '學費': 'parenting_學雜費', '補習': 'parenting_補習班',
    'YOUTUBE': 'play_APP訂閱', 'PREMIUM': 'play_APP訂閱', 'GPT': 'play_APP訂閱', 'DISNEY': 'play_APP訂閱', 'NETFLIX': 'play_APP訂閱', 'SPOTIFY': 'play_APP訂閱',
    '轉帳': 'other_手續費', '手續費': 'other_手續費', '紅包': 'other_人情紅包',
    '薪資': 'active_薪資', '薪水': 'active_薪資', '獎金': 'active_獎金',
    '股息': 'passive_股息', '利息': 'passive_利息'
};

window.QUOTES = [
    "每一塊錢都是你的士兵。", "理財就是理生活。", "複利是世界第八大奇蹟。", "不要為錢工作，讓錢為你工作。", "節儉是為了更自由的未來。"
];

// --- 2. HELPER FUNCTIONS ---

window.getFlatCategories = (categoryGroups) => {
    const flat = {};
    if(!categoryGroups) return flat;
    Object.values(categoryGroups).forEach(typeGroups => {
        typeGroups.forEach(group => {
            group.subs.forEach(sub => {
                const id = `${group.id}_${sub}`; 
                flat[id] = { id, name: sub, group: group.label, icon: group.icon, type: typeGroups === categoryGroups.expense ? 'expense' : 'income' };
            });
        });
    });
    return flat;
};

window.calculateBalance = (data, accId) => {
    const initial = data.accounts.find(a => a.id === accId)?.balance || 0;
    const txs = data.transactions.filter(t => t.accountId === accId || t.toAccountId === accId);
    return txs.reduce((acc, curr) => {
        const amount = curr.amount || 0;
        if ((curr.type === 'income' || curr.type === 'repay') && curr.accountId === accId) return acc + amount;
        if ((curr.type === 'expense' || curr.type === 'advance') && curr.accountId === accId) return acc - amount;
        if (curr.type === 'transfer') {
            if (curr.accountId === accId) return acc - amount; 
            if (curr.toAccountId === accId) return acc + amount; 
        }
        return acc;
    }, initial);
};

window.calculateMonthlyStats = (data, date = new Date()) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const userAccountIds = data.accounts.filter(a => a.userId === data.currentUser || (!a.userId && data.currentUser === 'default')).map(a => a.id);
    const txs = data.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === month && userAccountIds.includes(t.accountId);
    });
    
    const income = txs.reduce((sum, t) => t.type === 'income' ? sum + (t.amount || 0) : sum, 0); 
    
    // 支出計算：只計算屬於「我」的部分 (總額 - 分給別人的部分)
    // Updated: Only subtract splits where owner is NOT 'me'
    const expense = txs.reduce((sum, t) => {
        if (t.type === 'expense') {
            const splitDebtTotal = (t.splits || []).reduce((acc, s) => {
                if (s.owner !== 'me') {
                    return acc + (parseFloat(s.amount) || 0);
                }
                return acc;
            }, 0);
            return sum + ((t.amount || 0) - splitDebtTotal);
        }
        return sum;
    }, 0);
    return { income, expense };
};

window.autoTag = (note) => {
    if(!note) return 'other_其他';
    const lowerNote = note.toLowerCase();
    
    // Group 1: Food
    if (lowerNote.includes('qburger') || lowerNote.includes('統一') || lowerNote.includes('餐飲') || lowerNote.includes('食堂')) {
        return 'food_三餐';
    }
    
    // Group 2: Subscriptions
    if (lowerNote.includes('youtube') || lowerNote.includes('premium') || lowerNote.includes('gpt') || lowerNote.includes('disney') || lowerNote.includes('netflix') || lowerNote.includes('spotify')) {
        return 'play_APP訂閱';
    }

    for (let key in window.KEYWORD_MAPPING) if (lowerNote.includes(key.toLowerCase())) return window.KEYWORD_MAPPING[key];
    return 'other_其他'; 
};

window.getDebtSummary = (data, userId) => {
    const debts = {}; 
    const userTxs = data.transactions.filter(t => {
        const account = data.accounts.find(a => a.id === t.accountId);
        return account && account.userId === userId;
    });
    userTxs.forEach(tx => {
        const amount = tx.amount || 0;
        
        // 還款：對方還我錢，我的債權減少
        if (tx.type === 'repay' && tx.targetName) debts[tx.targetName] = (debts[tx.targetName] || 0) - amount;
        
        // 支出分帳/代墊：我付錢，分給別人 -> 別人欠我錢 (增加債權)
        if (tx.type === 'expense' && tx.splits && Array.isArray(tx.splits)) {
            tx.splits.forEach(split => {
                if (split.name && split.owner !== 'me') { // 檢查 split.name 確保是有效的對象
                    const name = split.name;
                    debts[name] = (debts[name] || 0) + (parseFloat(split.amount) || 0);
                }
            });
        }
        // Legacy advance support (If needed, although Advance is discouraged now)
        if (tx.type === 'advance' && tx.targetName) debts[tx.targetName] = (debts[tx.targetName] || 0) + amount;
    });
    return debts;
};

window.refreshIcons = () => { if (window.lucide) setTimeout(() => window.lucide.createIcons(), 50); };

// --- 3. COMMON COMPONENTS (Toast/Modal) ---
window.Toast = ({ message, type, onClose }) => {
    useEffect(() => { 
        if (message) {
            const timer = setTimeout(() => { if(onClose) onClose(); }, 1000); 
            return () => clearTimeout(timer); 
        }
    }, [message, onClose]);
    if (!message) return null;
    return <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"><div className="px-6 py-3 rounded-xl shadow-2xl text-sm font-medium tracking-wide animate-pop toast-bg">{message}</div></div>;
};

window.Modal = ({ children, onClose, title }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop cursor-pointer" onClick={onClose}>
        <div className="bg-muji-card w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-muji-border cursor-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-muji-border flex justify-between items-center bg-muji-bg">
                <h3 className="font-bold text-lg text-muji-text">{title}</h3>
                <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors"><i data-lucide="x" className="w-5 h-5 text-muji-muted"></i></button>
            </div>
            <div className="overflow-y-auto p-6 custom-scrollbar text-muji-text">{children}</div>
        </div>
    </div>
);