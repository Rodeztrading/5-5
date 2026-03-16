import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Plus, CheckCircle2, Circle, Trash2, ListTodo, MessageSquare, Clock, MapPin, User as UserIcon, Calendar, Bell, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { CustodyOverride, ChecklistItem, GeneralReminder, AnnualReminder } from '../types';
import { 
    saveCustodyOverride, 
    subscribeToCustodyOverrides, 
    saveGeneralReminder,
    deleteGeneralReminder,
    subscribeToGeneralReminders,
    saveAnnualReminder,
    deleteAnnualReminder,
    subscribeToAnnualReminders
} from '../services/firebaseService';

export const DominicView: React.FC = () => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [overrides, setOverrides] = useState<Record<string, CustodyOverride>>({});
    const [generalReminders, setGeneralReminders] = useState<GeneralReminder[]>([]);
    const [annualReminders, setAnnualReminders] = useState<AnnualReminder[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [newReminderText, setNewReminderText] = useState('');
    const [newChecklistItem, setNewChecklistItem] = useState('');
    const [newChecklistTime, setNewChecklistTime] = useState('');
    const [checklistResponsible, setChecklistResponsible] = useState<'MOM' | 'DAD'>('DAD');
    
    const [isAddingAnnual, setIsAddingAnnual] = useState(false);
    const [annualText, setAnnualText] = useState('');
    const [annualDay, setAnnualDay] = useState(1);
    const [annualMonth, setAnnualMonth] = useState(0);

    const formatDateKey = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const unsubscribeOverrides = subscribeToCustodyOverrides((data) => {
            const overridesMap: Record<string, CustodyOverride> = {};
            data.forEach(o => { overridesMap[o.date] = o; });
            setOverrides(overridesMap);
            setLoading(false);
        });
        const unsubscribeReminders = subscribeToGeneralReminders((data) => { setGeneralReminders(data); });
        const unsubscribeAnnual = subscribeToAnnualReminders((data) => {
            if (data.length === 0) {
                console.log('[DEBUG] No hay datos fijos en Firestore.');
            } else {
                alert('[DEBUG] Recordatorios fijos cargados: ' + data.length);
            }
            setAnnualReminders(data);
        });
        return () => { unsubscribeOverrides(); unsubscribeReminders(); unsubscribeAnnual(); };
    }, [user]);

    // Diagnostic alert to show data has arrived
    useEffect(() => {
        if (annualReminders.length > 0) {
            console.log('Recordatorios anuales cargados:', annualReminders.length);
        }
    }, [annualReminders]);

    const smartAlerts = useMemo(() => {
        const items: { text: string; type: 'today' | 'tomorrow' | 'upcoming', date?: string }[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        const todayKey = formatDateKey(today);
        const tomorrowKey = formatDateKey(tomorrow);

        const todayOverride = overrides[todayKey];
        if (todayOverride?.checklist?.filter(i => !i.completed).length) {
            items.push({ text: `Hoy: ${todayOverride.checklist.filter(i => !i.completed).length} tareas pendientes`, type: 'today' });
        }
        if (todayOverride?.pickupTime) {
            items.push({ text: `Hoy: Recogida de Dominic a las ${todayOverride.pickupTime}`, type: 'today' });
        }

        const tomorrowOverride = overrides[tomorrowKey];
        if (tomorrowOverride?.checklist?.length) {
            items.push({ text: `Mañana: Tienes ${tomorrowOverride.checklist.length} tareas programadas`, type: 'tomorrow' });
        }

        annualReminders.forEach(rem => {
            if (isNaN(rem.day) || isNaN(rem.month)) return;
            
            // Calculate this year's date and next year's date for comparison
            const remThisYear = new Date(today.getFullYear(), rem.month, rem.day);
            remThisYear.setHours(0, 0, 0, 0);
            
            let targetDate = remThisYear;
            if (targetDate < today) {
                targetDate = new Date(today.getFullYear() + 1, rem.month, rem.day);
                targetDate.setHours(0, 0, 0, 0);
            }
            
            const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            // Fixed triggers: 7 days, 3 days, 0 days
            if (diffDays === 0) {
                items.push({ text: `¡HOY! Es el día de: ${rem.text}`, type: 'upcoming' });
            } else if (diffDays === 3) {
                items.push({ text: `En 3 días: ${rem.text}`, type: 'upcoming' });
            } else if (diffDays === 7) {
                items.push({ text: `En 7 días: ${rem.text}`, type: 'upcoming' });
            }
        });

        return items;
    }, [overrides, annualReminders]);

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days: Date[] = [];
        const firstDayOfWeek = firstDay.getDay(); 
        const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        for (let i = adjustedFirstDay; i > 0; i--) days.push(new Date(year, month, 1 - i));
        for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
        const remainingCells = 42 - days.length;
        for (let i = 1; i <= remainingCells; i++) days.push(new Date(year, month + 1, i));
        return days;
    };

    const getResponsible = (date: Date) => {
        const dateString = formatDateKey(date);
        const epoch = new Date('2024-01-01T00:00:00');
        const d = new Date(date);
        d.setHours(0, 0, 0, 0); epoch.setHours(0, 0, 0, 0);
        const diffDays = Math.round((d.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
        const mod = ((diffDays % 4) + 4) % 4;
        const defaultResp = mod < 2 ? 'DAD' : 'MOM';

        const o = overrides[dateString];
        const dayAnnuals = annualReminders.filter(rem => rem.day === date.getDate() && rem.month === date.getMonth());
        
        if (o) {
            const hasChecklist = (o.checklist?.length || 0) > 0;
            const hasPickup = !!o.pickupTime && o.pickupTime.trim() !== '';
            const isCustodyChanged = o.responsible !== (o.originalResponsible || defaultResp);
            return { 
                responsible: o.responsible, isOverride: isCustodyChanged, originalResponsible: o.originalResponsible || defaultResp,
                hasData: hasChecklist || hasPickup || isCustodyChanged || dayAnnuals.length > 0
            };
        }
        return { responsible: defaultResp, isOverride: false, originalResponsible: defaultResp, hasData: dayAnnuals.length > 0 };
    };

    const updateOverride = async (date: Date, updates: Partial<CustodyOverride>) => {
        if (!user) return;
        const dateString = formatDateKey(date);
        const current = getResponsible(date);
        const existing = overrides[dateString];
        const override: CustodyOverride = {
            id: dateString, date: dateString,
            responsible: (updates.responsible || existing?.responsible || current.responsible) as 'MOM' | 'DAD',
            originalResponsible: (existing?.originalResponsible || current.originalResponsible) as 'MOM' | 'DAD',
            checklist: updates.checklist !== undefined ? updates.checklist : (existing?.checklist || []),
            pickupTime: updates.pickupTime !== undefined ? updates.pickupTime : (existing?.pickupTime || ''),
            createdAt: existing?.createdAt || Date.now()
        };
        try { await saveCustodyOverride(override); } catch (error) { console.error('Failed to save override', error); }
    };

    const handleDayClick = (date: Date) => setSelectedDate(date);
    const toggleCustodyOverride = async (date: Date) => {
        const current = getResponsible(date);
        await updateOverride(date, { responsible: current.responsible === 'MOM' ? 'DAD' : 'MOM' });
    };

    const handleAddChecklistItem = async () => {
        if (!selectedDate || !newChecklistItem.trim() || !user) return;
        const existing = overrides[formatDateKey(selectedDate)];
        const newItem: ChecklistItem = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            text: newChecklistItem.trim(), time: newChecklistTime.trim(), completed: false, responsible: checklistResponsible
        };
        await updateOverride(selectedDate, { checklist: [...(existing?.checklist || []), newItem] });
        setNewChecklistItem(''); setNewChecklistTime('');
    };

    const toggleChecklistItem = async (itemId: string) => {
        if (!selectedDate) return;
        const existing = overrides[formatDateKey(selectedDate)];
        if (!existing?.checklist) return;
        const newChecklist = existing.checklist.map(item => item.id === itemId ? { ...item, completed: !item.completed } : item);
        await updateOverride(selectedDate, { checklist: newChecklist });
    };

    const deleteChecklistItem = async (itemId: string) => {
        if (!selectedDate) return;
        const existing = overrides[formatDateKey(selectedDate)];
        if (!existing?.checklist) return;
        const newChecklist = existing.checklist.filter(item => item.id !== itemId);
        await updateOverride(selectedDate, { checklist: newChecklist });
    };

    const handleUpdatePickupTime = async (time: string) => { selectedDate && await updateOverride(selectedDate, { pickupTime: time }); };

    const handleAddGeneralReminder = async () => {
        if (!newReminderText.trim()) return;
        try {
            await saveGeneralReminder(newReminderText.trim());
            setNewReminderText('');
        } catch (error: any) { alert(`No se pudo guardar: ${error?.message || 'Error desconocido'}`); }
    };

    const handleAddAnnualReminder = async () => {
        if (!annualText.trim()) { alert('Por favor escribe el nombre del evento.'); return; }
        const day = parseInt(String(annualDay));
        const month = parseInt(String(annualMonth));
        if (isNaN(day) || day < 1 || day > 31) { alert('Día no válido.'); return; }
        if (isNaN(month) || month < 0 || month > 11) { alert('Mes no válido.'); return; }
        try {
            await saveAnnualReminder({ text: annualText.trim(), day, month, leadDays: 7 }); // Default lead for internal logic
            setAnnualText(''); setIsAddingAnnual(false);
        } catch (error: any) { alert(`No se pudo guardar: ${error?.message || 'Error desconocido'}`); }
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setCurrentDate(newDate);
    };

    const days = getDaysInMonth(currentDate);
    const monthName = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

    return (
        <div className="h-full overflow-y-auto bg-gray-950 p-2 md:p-6 custom-scrollbar text-white">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <header className="mb-4">
                            <h1 className="text-3xl font-black tracking-tight flex items-center">Dominic</h1>
                            <p className="text-sm text-gray-400 mt-1 flex items-center"><ListTodo className="w-4 h-4 mr-2 text-rodez-red" /> Gestión de Custodia y Tareas</p>
                        </header>
                        <div className="space-y-4">
                            <div className="flex flex-col space-y-2">
                                <div className="flex items-center p-3 bg-pink-500/10 border border-pink-500/20 rounded-xl"><div className="w-3 h-3 rounded-full bg-pink-500 mr-3"></div><span className="text-pink-100 font-bold text-xs uppercase">MAMÁ</span></div>
                                <div className="flex items-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl"><div className="w-3 h-3 rounded-full bg-blue-500 mr-3"></div><span className="text-blue-100 font-bold text-xs uppercase">PAPÁ</span></div>
                            </div>
                            <div className="bg-gray-900 shadow-xl border border-gray-800 rounded-2xl overflow-hidden">
                                <button onClick={() => setIsAddingAnnual(!isAddingAnnual)} className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-all border-b border-gray-800">
                                    <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase flex items-center"><Calendar className="w-3 h-3 mr-2 text-rodez-red" /> Recordatorios Fijos</span>
                                    <Plus className={`w-4 h-4 text-rodez-red transition-transform ${isAddingAnnual ? 'rotate-45' : ''}`} />
                                </button>
                                <div className="max-h-[150px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    {annualReminders.length > 0 ? annualReminders.map(rem => (
                                        <div key={rem.id} className="flex justify-between items-center bg-gray-950 p-2 rounded-lg border border-gray-800/50 group">
                                            <div className="flex flex-col"><span className="text-[10px] font-bold text-gray-200">{rem.text}</span><span className="text-[8px] text-gray-500">{rem.day}/{rem.month + 1}</span></div>
                                            <button onClick={() => deleteAnnualReminder(rem.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-all px-2"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    )) : <div className="text-[9px] text-gray-700 italic text-center py-4">No hay recordatorios fijos</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-2 flex flex-col gap-4">
                        {smartAlerts.length > 0 && (
                            <div className="bg-rodez-red/10 border border-rodez-red/20 rounded-[2rem] p-4 flex items-start gap-4 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                                <div className="bg-rodez-red p-3 rounded-2xl text-white shadow-lg animate-pulse"><Bell className="w-5 h-5" /></div>
                                <div className="flex-1">
                                    <h3 className="text-[10px] font-black tracking-[0.2em] text-rodez-red uppercase mb-2">Recordatorios Importantes</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {smartAlerts.slice(0, 4).map((alert, i) => (
                                            <div key={i} className="flex items-center text-xs font-bold text-gray-100 bg-gray-950/50 px-3 py-2 rounded-xl border border-gray-800/50 shadow-sm animate-in fade-in slide-in-from-top-1">
                                                <AlertCircle className={`w-3 h-3 mr-2 ${alert.type === 'upcoming' ? 'text-yellow-500' : 'text-rodez-red'}`} />
                                                <span className="truncate">{alert.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="bg-gray-900 shadow-2xl border border-gray-800 rounded-[2.5rem] p-6 backdrop-blur-sm flex-1 flex flex-col">
                            <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center"><MessageSquare className="w-4 h-4 mr-2 text-yellow-500" /> Recordatorios Generales</h2>
                            <div className="flex-1 overflow-y-auto max-h-[120px] mb-4 space-y-2 pr-2 custom-scrollbar">
                                {generalReminders.map(rem => (
                                    <div key={rem.id} className="flex justify-between items-center bg-gray-950/50 p-3 rounded-xl border border-gray-800 hover:border-gray-700 transition-all group">
                                        <span className="text-sm text-gray-200">{rem.text}</span>
                                        <button onClick={() => deleteGeneralReminder(rem.id)} className="p-1.5 hover:bg-red-500/20 text-gray-500 hover:text-red-500 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center mt-auto bg-gray-950 rounded-2xl p-1 border border-gray-800 focus-within:border-rodez-red transition-all shadow-inner">
                                <input type="text" placeholder="Agrega un recordatorio rápido..." className="flex-1 bg-transparent px-4 py-2 text-xs text-white focus:outline-none" value={newReminderText} onChange={(e) => setNewReminderText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddGeneralReminder()} />
                                <button onClick={handleAddGeneralReminder} className="bg-rodez-red p-2 rounded-xl text-white hover:bg-red-600 transition-all active:scale-95 shadow-md"><Plus className="w-5 h-5" /></button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="p-6 md:p-8 flex items-center justify-between border-b border-gray-800 bg-gray-800/20">
                        <button onClick={() => changeMonth(-1)} className="p-3 hover:bg-gray-700/50 rounded-2xl transition-all text-gray-400"><ChevronLeft className="w-6 h-6" /></button>
                        <h2 className="text-xl md:text-3xl font-black capitalize tracking-tight">{monthName}</h2>
                        <button onClick={() => changeMonth(1)} className="p-3 hover:bg-gray-700/50 rounded-2xl transition-all text-gray-400"><ChevronRight className="w-6 h-6" /></button>
                    </div>
                    <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-950/50">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (<div key={day} className="py-4 text-center text-[10px] md:text-xs font-black text-gray-600 uppercase tracking-widest">{day}</div>))}
                    </div>
                    <div className="grid grid-cols-7 auto-rows-fr">
                        {days.map((date, index) => {
                            const { responsible, isOverride, hasData: baseHasData } = getResponsible(date);
                            const override = overrides[formatDateKey(date)];
                            const pendingItems = override?.checklist?.filter(i => !i.completed) || [];
                            const dayAnnuals = annualReminders.filter(rem => rem.day === date.getDate() && rem.month === date.getMonth());
                            const hasData = baseHasData || dayAnnuals.length > 0;
                            const isToday = new Date().toDateString() === date.toDateString();
                            return (
                                <div key={index} onClick={() => handleDayClick(date)} className={`min-h-[100px] md:min-h-[160px] p-2 md:p-4 border-b border-r border-gray-800 relative cursor-pointer transition-all hover:bg-gray-800/30 group ${date.getMonth() !== currentDate.getMonth() ? 'opacity-20 pointer-events-none' : ''} ${isToday ? 'bg-rodez-red/5' : ''}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-xs md:text-lg font-black w-7 h-7 md:w-10 md:h-10 flex items-center justify-center rounded-2xl ${isToday ? 'bg-rodez-red shadow-lg' : 'text-gray-500 group-hover:text-gray-300'}`}>{date.getDate()}</span>
                                        <div className="flex gap-1">
                                            {dayAnnuals.length > 0 && <div className="bg-rodez-red text-white text-[8px] font-black h-5 px-1.5 rounded-lg flex items-center shadow-lg shadow-rodez-red/30"><Calendar className="w-2.5 h-2.5 mr-1" />{dayAnnuals.length}</div>}
                                            {pendingItems.length > 0 && <div className="bg-yellow-500 text-black text-[10px] font-black h-5 px-1.5 rounded-lg flex items-center justify-center animate-pulse shadow-lg shadow-yellow-500/20">{pendingItems.length}</div>}
                                        </div>
                                    </div>
                                    <div className="space-y-1 mb-2">
                                        {dayAnnuals.slice(0, 1).map(rem => (<div key={rem.id} className="flex items-center text-[8px] md:text-[10px] text-rodez-red font-black bg-rodez-red/10 rounded px-1.5 py-1 border border-rodez-red/20 truncate animate-in slide-in-from-left-1"><Calendar className="w-2.5 h-2.5 mr-1.5 flex-shrink-0" /><span className="truncate">{rem.text}</span></div>))}
                                        {override?.pickupTime && <div className="flex items-center text-[8px] md:text-[10px] text-gray-400 bg-gray-950/40 rounded px-1.5 py-0.5 border border-gray-800/50 truncate"><Clock className="w-2.5 h-2.5 mr-1.5 text-green-500 flex-shrink-0" /><span className="truncate">Recojo: {override.pickupTime}</span></div>}
                                        {pendingItems.slice(0, 1).map(item => <div key={item.id} className="flex items-center text-[8px] md:text-[10px] text-gray-400 px-1 truncate"><div className={`w-1 h-1 rounded-full mr-1.5 flex-shrink-0 ${item.responsible === 'MOM' ? 'bg-pink-500' : 'bg-blue-500'}`}></div><span className="truncate">{item.time && `${item.time} - `}{item.text}</span></div>)}
                                    </div>
                                    <div className={`mt-auto p-1.5 md:p-2 rounded-xl text-[9px] md:text-[10px] font-black text-center uppercase border transition-all ${responsible === 'MOM' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'} ${isOverride ? 'ring-2 ring-yellow-500/50 shadow-lg' : ''}`}>{responsible === 'MOM' ? 'MAMÁ' : 'PAPÁ'}</div>
                                    {hasData && <div className="absolute top-2 right-2"><div className={`w-1.5 h-1.5 rounded-full ${isOverride ? 'bg-yellow-500 shadow-md' : 'bg-gray-600'}`}></div></div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* MODAL: Annual Reminder Creator */}
            {isAddingAnnual && (
                <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between"><h3 className="text-xl font-black flex items-center"><Calendar className="w-6 h-6 mr-3 text-rodez-red" /> Nuevo Recordatorio Fijo</h3><button onClick={() => setIsAddingAnnual(false)} className="p-2 hover:bg-gray-800 rounded-full transition-all"><ChevronLeft className="w-5 h-5 rotate-90" /></button></div>
                        <div className="space-y-4">
                            <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Evento / Fecha Especial</label><input type="text" placeholder="Ej. Cumpleaños Mamá..." className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-4 text-sm focus:border-rodez-red outline-none transition-all" value={annualText} onChange={(e) => setAnnualText(e.target.value)} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Día (1-31)</label><input type="number" min="1" max="31" className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-4 text-sm focus:border-rodez-red outline-none" value={annualDay} onChange={(e) => setAnnualDay(parseInt(e.target.value) || 1)} /></div>
                                <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Mes</label><select className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-4 text-sm focus:border-rodez-red outline-none" value={annualMonth} onChange={(e) => setAnnualMonth(parseInt(e.target.value) || 0)}>{['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => <option key={i} value={i}>{m}</option>)}</select></div>
                            </div>
                        </div>
                        <div className="bg-gray-950/50 p-4 rounded-2xl border border-gray-800 text-[10px] text-gray-400 font-bold leading-relaxed italic"><span className="text-rodez-red block not-italic mb-1 tracking-widest">RECORDATORIO INTELIGENTE:</span> Recibirás alertas 7 días antes, 3 días antes y el mismo día del evento.</div>
                        <button onClick={handleAddAnnualReminder} className="w-full bg-rodez-red py-4 rounded-2xl font-black text-xs hover:bg-red-600 transition-all shadow-xl shadow-rodez-red/25 active:scale-95 uppercase tracking-widest">Guardar Recordatorio Anual</button>
                    </div>
                </div>
            )}

            {/* MODAL: Day Details */}
            {selectedDate && (
                <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-gray-900 border border-gray-800 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh] animate-in fade-in zoom-in-95">
                        <div className={`p-8 md:w-1/3 flex flex-col justify-between ${getResponsible(selectedDate).responsible === 'MOM' ? 'bg-pink-500/10' : 'bg-blue-500/10'}`}>
                            <div className="space-y-6">
                                <div><h3 className="text-5xl font-black mb-1">{selectedDate.getDate()}</h3><p className="text-gray-400 uppercase tracking-widest text-[10px] font-black">{selectedDate.toLocaleString('es-ES', { month: 'long', weekday: 'long' })}</p></div>
                                <div className="space-y-4">
                                    <div className="flex flex-col"><span className="text-[10px] text-gray-500 font-black uppercase mb-2">Custodia Hoy:</span><div className={`p-4 rounded-3xl border font-black text-center text-sm shadow-lg ${getResponsible(selectedDate).responsible === 'MOM' ? 'bg-pink-500 text-white' : 'bg-blue-500 text-white'}`}>{getResponsible(selectedDate).responsible === 'MOM' ? 'MAMÁ' : 'PAPÁ'}</div></div>
                                    <button onClick={() => toggleCustodyOverride(selectedDate)} className="w-full py-3 bg-gray-950 border border-gray-800 rounded-2xl text-[10px] font-black text-gray-400 hover:text-white transition-all flex items-center justify-center active:scale-95"><RefreshCw className="w-3 h-3 mr-2" /> CAMBIAR RESPONSABLE</button>
                                    <div className="pt-4 border-t border-gray-800/50"><span className="text-[10px] text-gray-500 font-black uppercase mb-2 block">Recogida Dominic:</span><input type="text" placeholder="Ej. 4:50 pm..." className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-4 text-sm focus:border-green-500 outline-none font-bold shadow-inner" value={overrides[formatDateKey(selectedDate)]?.pickupTime || ''} onChange={(e) => handleUpdatePickupTime(e.target.value)} /></div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDate(null)} className="mt-8 py-4 bg-gray-950 rounded-2xl text-white font-black hover:bg-gray-800 transition-all border border-gray-800 text-xs shadow-lg">CERRAR PANEL</button>
                        </div>
                        <div className="flex-1 p-8 flex flex-col overflow-hidden">
                            {annualReminders.filter(rem => rem.day === selectedDate.getDate() && rem.month === selectedDate.getMonth()).map(rem => (
                                <div key={rem.id} className="mb-4 bg-rodez-red/10 border border-rodez-red/20 p-4 rounded-2xl flex items-center gap-3 animate-pulse shadow-lg shadow-rodez-red/10">
                                    <Calendar className="w-5 h-5 text-rodez-red" />
                                    <div><h5 className="text-[10px] font-black text-rodez-red uppercase tracking-widest">Recordatorio Anual</h5><p className="text-sm font-bold text-gray-100">{rem.text}</p></div>
                                </div>
                            ))}
                            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6 flex items-center"><ListTodo className="w-4 h-4 mr-2 text-rodez-red" /> TAREAS Y CITAS</h4>
                            <div className="flex-1 overflow-y-auto mb-6 pr-2 custom-scrollbar space-y-3">
                                {(overrides[formatDateKey(selectedDate)]?.checklist || []).map(item => (
                                    <div key={item.id} className="flex items-center group bg-gray-950/80 p-4 rounded-2xl border border-gray-800 hover:border-rodez-red/30 transition-all shadow-sm">
                                        <button onClick={() => toggleChecklistItem(item.id)} className="mr-4 active:scale-90 transition-transform">{item.completed ? <CheckCircle2 className="w-7 h-7 text-green-500" /> : <Circle className="w-7 h-7 text-gray-700 hover:text-gray-500" />}</button>
                                        <div className="flex-1 flex flex-col"><span className={`text-sm ${item.completed ? 'text-gray-600 line-through' : 'text-gray-100 font-bold'}`}>{item.text}</span><div className="flex items-center mt-1 gap-3"><div className="flex items-center"><div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${item.responsible === 'MOM' ? 'bg-pink-500' : 'bg-blue-500'}`}></div><span className="text-[10px] text-gray-500 font-black uppercase">{item.responsible === 'MOM' ? 'Mamá' : 'Papá'}</span></div>{item.time && <div className="flex items-center text-[8px] text-rodez-red font-black"><Clock className="w-3 h-3 mr-1" /> {item.time}</div>}</div></div>
                                        <button onClick={() => deleteChecklistItem(item.id)} className="ml-4 opacity-0 group-hover:opacity-100 p-2 text-gray-700 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-gray-950 rounded-[2.5rem] p-5 border border-gray-800 space-y-4 shadow-2xl">
                                <div className="flex gap-2"><button onClick={() => setChecklistResponsible('DAD')} className={`flex-1 py-3 rounded-2xl border text-[9px] font-black tracking-widest transition-all ${checklistResponsible === 'DAD' ? 'bg-blue-500 text-white border-blue-400 shadow-lg' : 'bg-gray-900 border-gray-800 text-gray-600'}`}>PAPÁ</button><button onClick={() => setChecklistResponsible('MOM')} className={`flex-1 py-3 rounded-2xl border text-[9px] font-black tracking-widest transition-all ${checklistResponsible === 'MOM' ? 'bg-pink-500 text-white border-pink-400 shadow-lg' : 'bg-gray-900 border-gray-800 text-gray-600'}`}>MAMÁ</button></div>
                                <div className="flex gap-2"><input type="text" placeholder="H..." className="w-20 bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-xs focus:border-rodez-red outline-none shadow-inner" value={newChecklistTime} onChange={(e) => setNewChecklistTime(e.target.value)} /><input type="text" placeholder="Nueva tarea..." className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-xs focus:border-rodez-red outline-none shadow-inner" value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()} /><button onClick={handleAddChecklistItem} className="bg-rodez-red p-3 rounded-2xl text-white hover:bg-red-600 active:scale-90 transition-all shadow-lg"><Plus className="w-6 h-6" /></button></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
