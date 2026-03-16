import React, { useEffect, useRef, useState } from 'react';
import { generateTimelineData, getTodayString } from '../utils/dateHelper';
import { TradingDay, VisualTrade } from '../types';
import { useTradingCoach } from '../hooks/useTradingCoach';
import { Play, Square, TrendingUp, TrendingDown, Target, ShieldAlert, AlertTriangle, Clock, Activity, Percent, DollarSign, Crosshair, Maximize2, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface RodezViewProps {
  trades: VisualTrade[];
  onSaveTrade: (trade: Omit<VisualTrade, 'id' | 'createdAt'>) => void;
}

export const RodezView: React.FC<RodezViewProps> = ({ trades, onSaveTrade }) => {
  const coach = useTradingCoach();
  const [initialCapitalTemp, setInitialCapitalTemp] = useState('1000');
  const [sessionInvestmentTemp, setSessionInvestmentTemp] = useState('200');
  const [globalPayoutTemp, setGlobalPayoutTemp] = useState('85');
  const [currentTradePayout, setCurrentTradePayout] = useState('85'); // Modificable por operación
  const [editableAmount, setEditableAmount] = useState('0'); // Monto editable por el usuario

  // Timeline State
  const [days, setDays] = useState<TradingDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<TradingDay | null>(null);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);
  const dateRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // View Image State
  const [viewTrade, setViewTrade] = useState<VisualTrade | null>(null);

  const displayTrades = selectedDay ? [...selectedDay.trades].reverse() : [];

  useEffect(() => {
    const data = generateTimelineData(trades, 30, 5);
    setDays(data);

    if (selectedDay) {
      const updatedDay = data.find(d => d.date === selectedDay.date);
      if (updatedDay) setSelectedDay(updatedDay);
    } else {
      const today = getTodayString();
      const todayData = data.find(d => d.date === today);
      if (todayData) setSelectedDay(todayData);
    }
  }, [trades]);

  useEffect(() => {
    if (days.length > 0 && !hasScrolledToToday) {
      const today = getTodayString();
      const element = dateRefs.current[today];
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHasScrolledToToday(true);
        }, 100);
      }
    }
  }, [days.length, hasScrolledToToday]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewTrade) return;
      if (e.key === 'Escape') setViewTrade(null);
      else if (e.key === 'ArrowLeft') navigateTrade('prev');
      else if (e.key === 'ArrowRight') navigateTrade('next');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewTrade, displayTrades]);

  // Synchronize editable amount with coach recommendation
  useEffect(() => {
    if (coach.suggestedAmount > 0) {
      setEditableAmount(coach.suggestedAmount.toString());
    }
  }, [coach.suggestedAmount]);

  const handleDayClick = (day: TradingDay) => setSelectedDay(day);

  const navigateTrade = (direction: 'next' | 'prev') => {
    if (!viewTrade || displayTrades.length === 0) return;
    const currentIndex = displayTrades.findIndex(t => t.id === viewTrade.id);
    if (currentIndex === -1) return;
    if (direction === 'next' && currentIndex < displayTrades.length - 1) {
      setViewTrade(displayTrades[currentIndex + 1]);
    } else if (direction === 'prev' && currentIndex > 0) {
      setViewTrade(displayTrades[currentIndex - 1]);
    }
  };

  const calculateWinRate = (day: TradingDay) => {
    const total = day.itm + day.otm;
    return total > 0 ? ((day.itm / total) * 100).toFixed(0) : '0';
  };

  const handleStartSession = () => {
    const cap = parseFloat(initialCapitalTemp);
    const inv = parseFloat(sessionInvestmentTemp);
    if (!isNaN(cap) && cap > 0 && !isNaN(inv) && inv > 0) {
      coach.startSession(cap, inv);
      setCurrentTradePayout('85'); // Set initial per trade payout
    }
  };

  const currentModeColors: any = {
    'CALENTAMIENTO': 'text-blue-400 bg-blue-900/30 border-blue-900',
    'ZONA DE TRABAJO': 'text-green-400 bg-green-900/30 border-green-900',
    'CRECIMIENTO': 'text-purple-400 bg-purple-900/30 border-purple-900',
    'DEFENSA': 'text-orange-400 bg-orange-900/30 border-orange-900',
  };

  const handleTradeRecord = (outcome: 'WIN' | 'LOSS') => {
    const payoutDec = parseFloat(currentTradePayout) / 100;
    const amount = parseFloat(editableAmount) || coach.suggestedAmount;
    
    // Register in Coach
    coach.registerTrade(outcome, amount, payoutDec);

    // Save globally to Firebase timeline
    onSaveTrade({
       userAction: 'CALL', // Dummy default for rapid tracking
       outcome,
       amountInvested: amount,
       payout: parseFloat(currentTradePayout),
       tradeImage: {
          mimeType: 'image/png',
          url: '' // Invisible dummy image
       }
    });
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-gray-950 text-gray-100 overflow-hidden relative">
      
      {/* LEFT COLUMN: TIMELINE */}
      <div className="w-full md:w-1/3 lg:w-1/5 border-r border-gray-800 flex flex-col h-1/3 md:h-[calc(100vh-6rem)] bg-gray-900/50 order-last md:order-first z-30">
        <div className="p-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm z-10 sticky top-0">
          <h2 className="text-sm font-bold flex items-center text-white uppercase tracking-wider">
            <Activity className="w-4 h-4 mr-2 text-rodez-red" />
            Calendario
          </h2>
        </div>
        <div ref={containerRef} className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {days.map((day) => {
            const isToday = day.date === getTodayString();
            const isSelected = selectedDay?.date === day.date;
            const hasActivity = day.trades.length > 0;
            const isProfit = day.pnl >= 0;
            return (
              <div
                key={day.date}
                ref={(el) => { dateRefs.current[day.date] = el; }}
                onClick={() => handleDayClick(day)}
                className={`
              relative p-3 rounded-lg border cursor-pointer transition-all duration-200
              ${isSelected ? 'bg-gray-800 border-rodez-red ring-1 ring-rodez-red' : 'bg-transparent border-gray-800 hover:bg-gray-800/50 hover:border-gray-700'}
              ${day.status === 'WEEKEND' ? 'opacity-40' : ''}
            `}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-mono font-bold ${isToday ? 'text-rodez-red' : 'text-gray-400'}`}>
                    {day.date}
                  </span>
                  {isToday && coach.isActive && <span className="w-2 h-2 rounded-full bg-sniper-blue animate-pulse" />}
                </div>
                {hasActivity ? (
                  <div className="flex justify-between items-end">
                    <div className="text-[10px] text-gray-500">
                      {day.itm}W - {day.otm}L
                    </div>
                    <div className={`text-xs font-bold font-mono ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                      {day.pnl >= 0 ? '+' : ''}{day.pnl.toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-600 italic">Sin actividad</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: MAIN CONTENT */}
      <div className="flex-1 h-full overflow-y-auto bg-gray-950 relative order-first md:order-last">
        
        {selectedDay?.date === getTodayString() ? (
           /* TODAY: COACH DASHBOARD OR SETUP */
           coach.isActive ? (
             <div className="flex flex-col h-full w-full custom-scrollbar pb-10">
                {/* COACH HEADER */}
                <header className="flex flex-col md:flex-row items-center justify-between p-4 md:px-8 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md shadow-sm sticky top-0 z-20">
                  <div className="flex items-center w-full md:w-auto justify-between md:justify-start space-x-4 mb-4 md:mb-0">
                     <div className="flex items-center space-x-2">
                       <div className="w-3 h-3 rounded-full bg-green-500 animate-[pulse_1.5s_ease-in-out_infinite]"></div>
                       <span className="font-bold tracking-widest text-sm uppercase text-white hidden md:inline">Sesión Activa</span>
                     </div>
                     <div className="h-6 w-px bg-gray-700 hidden md:block"></div>
                     <div className="flex items-center text-gray-300 font-mono xl:text-xl">
                       <Clock className="w-4 h-4 md:w-5 md:h-5 mr-2 text-gray-500" />
                       {coach.sessionDurationStr}
                     </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end space-x-4 md:space-x-8 w-full md:w-auto">
                     <div className="flex flex-col items-center">
                       <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Modo</span>
                       <span className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-bold border mt-1 whitespace-nowrap ${currentModeColors[coach.currentMode]}`}>
                         {coach.currentMode}
                       </span>
                     </div>
                     <div className="flex flex-col items-center">
                       <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider whitespace-nowrap">P/L Neto</span>
                       <span className={`text-sm md:text-xl font-mono font-bold ${coach.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                         {coach.pnl >= 0 ? '+' : ''}${coach.pnl.toFixed(2)}
                       </span>
                     </div>
                     <div className="flex flex-col items-center">
                       <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Acertividad</span>
                       <span className="text-sm md:text-xl font-mono font-bold text-white">{coach.accuracy.toFixed(0)}%</span>
                     </div>
                  </div>
                </header>

                {/* ALERTS */}
                {coach.alerts.length > 0 && (
                   <div className="bg-orange-950/80 border-b border-orange-500/30 p-3 flex items-center justify-center z-10">
                      <AlertTriangle className="w-5 h-5 text-orange-400 mr-2 flex-shrink-0" />
                      <span className="text-white font-bold text-sm tracking-wide text-center">
                         {coach.alerts.join(' • ')}
                      </span>
                      <button onClick={coach.clearAlerts} className="ml-4 text-orange-400/50 hover:text-orange-400">
                        <Square className="w-3 h-3" />
                      </button>
                   </div>
                )}

                {/* COACH DASHBOARD GRID */}
                <div className="max-w-5xl mx-auto w-full p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
                   <div className="lg:col-span-8 flex flex-col space-y-6">
                      
                      {/* OPERATIONS TABLE CARD */}
                      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 flex flex-col flex-1 shadow-2xl min-h-[300px] lg:min-h-[400px]">
                        <div className="mb-4 pb-4 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center">
                            <Clock className="w-4 h-4 mr-2" /> Historial de Sesión
                          </h3>
                          <div className="flex flex-col items-end gap-2">
                             <div className="flex items-center space-x-3 bg-gray-950/80 px-4 py-2 rounded-xl border border-gray-800/80 shadow-inner">
                               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Invertir:</span>
                               <div className="flex items-center">
                                 <span className="text-xl md:text-2xl font-black font-mono text-white mr-1">$</span>
                                 <input
                                   type="number"
                                   value={editableAmount}
                                   onChange={(e) => setEditableAmount(e.target.value)}
                                   className="text-xl md:text-2xl font-black font-mono text-white bg-transparent border-none focus:outline-none w-24"
                                   placeholder="0.00"
                                 />
                               </div>
                               {coach.nextAmountReason && (
                                 <>
                                   <div className="w-px h-6 bg-gray-800 mx-1"></div>
                                   <span className="text-[10px] uppercase text-rodez-red font-bold hidden md:block">{coach.nextAmountReason}</span>
                                 </>
                               )}
                             </div>
                             
                             {/* WIN / LOSS AND PAYOUT CONTROLS */}
                             <div className="flex items-center space-x-2 w-full justify-end">
                                <div className="flex items-center bg-gray-950 px-2 py-1.5 rounded-lg border border-gray-800 relative group">
                                  <Percent className="w-3 h-3 text-gray-500 mr-1" />
                                  <input
                                     type="number"
                                     value={currentTradePayout}
                                     onChange={(e) => setCurrentTradePayout(e.target.value)}
                                     title="Payout %"
                                     className="w-12 bg-transparent text-white font-mono text-center text-xs focus:outline-none"
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                   <button 
                                      onClick={() => handleTradeRecord('WIN')}
                                      disabled={coach.isBlocked}
                                      className="bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg px-4 py-1.5 flex items-center transition-all disabled:opacity-30 active:scale-95"
                                   >
                                      <TrendingUp className="w-3 h-3 mr-1.5" />
                                      <span className="text-xs font-black tracking-widest">WIN</span>
                                   </button>
                                   <button 
                                      onClick={() => handleTradeRecord('LOSS')}
                                      disabled={coach.isBlocked}
                                      className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 rounded-lg px-4 py-1.5 flex items-center transition-all disabled:opacity-30 active:scale-95"
                                   >
                                      <TrendingDown className="w-3 h-3 mr-1.5" />
                                      <span className="text-xs font-black tracking-widest">LOSS</span>
                                   </button>
                                </div>
                             </div>
                          </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[350px] md:max-h-[500px]">
                           {coach.trades.length > 0 ? (
                              <table className="w-full text-left text-sm">
                                 <thead className="text-[10px] text-gray-500 uppercase font-bold sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10">
                                   <tr>
                                     <th className="pb-3 pt-2">Operación</th>
                                     <th className="pb-3 pt-2 text-right">Inversión</th>
                                     <th className="pb-3 pt-2 text-right">Resultado</th>
                                     <th className="pb-3 pt-2 text-right">Balance</th>
                                     <th className="pb-3 pt-2 text-center">Estado</th>
                                   </tr>
                                 </thead>
                                 <tbody className="font-mono text-xs">
                                    {[...coach.trades].reverse().map((trade, idx) => {
                                       const actualIdx = coach.trades.length - idx;
                                       
                                       // Calculate running balance for this point in time
                                       let runningPnl = 0;
                                       for(let i=0; i<actualIdx; i++) {
                                          runningPnl += coach.trades[i].profit;
                                       }

                                       const estadoColors: any = {
                                          'normal': 'text-gray-400 border-gray-700',
                                          'racha': 'text-blue-400 border-blue-800 bg-blue-900/20',
                                          'recuperación': 'text-purple-400 border-purple-800 bg-purple-900/20',
                                          'defensa': 'text-orange-400 border-orange-800 bg-orange-900/20',
                                       };

                                       return (
                                       <tr key={trade.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                                         <td className="py-3 text-gray-400 font-bold">{actualIdx}</td>
                                         <td className="py-3 text-right text-gray-300">
                                            {trade.amountInvested.toFixed(2)}
                                         </td>
                                         <td className={`py-3 text-right font-bold ${trade.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}
                                         </td>
                                         <td className={`py-3 text-right font-bold ${runningPnl > 0 ? 'text-green-400' : runningPnl < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                            {runningPnl > 0 ? '+' : ''}{runningPnl.toFixed(2)}
                                         </td>
                                         <td className="py-3 text-center">
                                            <span className={`px-2 py-1 uppercase text-[9px] font-bold rounded-full border ${estadoColors[trade.estado || 'normal']}`}>
                                               {trade.estado || 'normal'}
                                            </span>
                                         </td>
                                       </tr>
                                    )})}
                                 </tbody>
                              </table>
                           ) : (
                             <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-3 opacity-50 py-10">
                                <Crosshair className="w-10 h-10" />
                                <span className="text-xs uppercase tracking-widest font-bold">Sin Operaciones</span>
                             </div>
                           )}
                        </div>
                      </div>
                   </div>

                   {/* RIGHT PANEL STATS & CONTROLS */}
                   <div className="lg:col-span-4 flex flex-col space-y-6">
                     
                      {/* COACH STATUS / BLOCK OVERLAY IN PLACE OF BIG CARD */}
                      {coach.lossStreak >= 3 && !coach.isBlocked && (
                          <div className="bg-red-950 border border-red-800 rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg animate-pulse text-center">
                             <ShieldAlert className="w-10 h-10 text-red-500 mb-2" />
                             <h2 className="text-sm font-black text-red-400 tracking-widest uppercase mb-2">Tranquilo, tú puedes</h2>
                             <div className="text-sm font-medium text-white max-w-xs leading-relaxed">
                               Solo ten calma, marca tu zona, espera que el precio muestre su rechazo, recuerda no es adivinar.
                             </div>
                          </div>
                      )}

                      {coach.isBlocked && (
                          <div className="bg-red-950 border border-red-800 rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg animate-pulse text-center">
                             <ShieldAlert className="w-10 h-10 text-red-500 mb-2" />
                             <h2 className="text-sm font-black text-red-400 tracking-widest uppercase mb-2">Pausa Obligatoria</h2>
                             <div className="text-sm font-medium text-white max-w-xs leading-relaxed">
                               Stop Loss alcanzado. Presupuesto de sesión agotado.
                             </div>
                             <div className="mt-4 px-3 py-1 bg-red-900/50 rounded-full text-xs font-mono text-red-300">
                               {coach.blockRemainingStr}
                             </div>
                          </div>
                      )}

                     {/* METRICS CARD */}
                     <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 flex flex-col">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 pb-4 border-b border-gray-800 flex justify-between">
                           <span>Métricas</span>
                           <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              coach.currentMode === 'CRECIMIENTO' ? 'text-purple-400 border-purple-800 bg-purple-900/20' : 
                              coach.currentMode === 'DEFENSA' ? 'text-orange-400 border-orange-800 bg-orange-900/20' : 
                              coach.currentMode === 'CALENTAMIENTO' ? 'text-blue-400 border-blue-800 bg-blue-900/20' : 
                              'text-green-400 border-green-800 bg-green-900/20'
                           }`}>{coach.currentMode}</span>
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-y-6 gap-x-2">
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Racha Actual</div>
                              <div className="text-lg font-mono font-bold text-white">
                                {coach.winStreak > 0 ? <span className="text-green-400">+{coach.winStreak} V</span> : coach.lossStreak > 0 ? <span className="text-red-400">-{coach.lossStreak} D</span> : '-'}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Racha Máxima</div>
                              <div className="text-lg font-mono text-purple-400 font-bold">{coach.maxStreak} V</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Total Ops</div>
                              <div className="text-lg font-mono text-white font-bold">{coach.trades.length}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Resultado (W/L)</div>
                              <div className="text-lg font-mono font-bold"><span className="text-green-400">{coach.wins}</span>/<span className="text-red-400">{coach.losses}</span></div>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-800">
                           <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-500 mb-2 uppercase">
                             <span>Capital Total: ${coach.capital.toFixed(2)}</span>
                             <span className="text-right">Inversión Sesión: ${coach.sessionInvestment.toFixed(2)}</span>
                             <span>P/L Neto: <span className={coach.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>${coach.pnl.toFixed(2)}</span></span>
                             <span className={`text-right ${coach.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>Saldo: ${(coach.capital + coach.pnl).toFixed(2)}</span>
                           </div>
                           <div className="h-2 w-full bg-gray-950 rounded-full overflow-hidden flex mb-6">
                              {coach.pnl >= 0 ? (
                                 <div style={{ width: `${Math.min(100, 50 + ((coach.pnl/coach.sessionInvestment)*50))}%` }} className="bg-green-500 h-full transition-all"></div>
                              ) : (
                                 <div style={{ width: `${Math.max(0, 50 + ((coach.pnl/coach.sessionInvestment)*50))}%` }} className="bg-red-500 h-full transition-all"></div>
                              )}
                           </div>

                           <button 
                              onClick={() => {
                                 if(window.confirm('¿Finalizar sesión? Quedará registrado en el calendario localmente.')) coach.endSession();
                              }}
                              className="w-full bg-transparent border-2 border-gray-800 hover:border-red-500/50 hover:bg-red-950/20 text-gray-500 text-sm font-bold py-3 rounded-xl transition-all flex items-center justify-center mt-6"
                           >
                              <Square className="w-4 h-4 mr-2" /> FINALIZAR SESIÓN
                           </button>
                        </div>
                     </div>

                   </div>
                </div>

             </div>
           ) : (
             /* SETUP SESSION */
             <div className="flex h-full items-center justify-center p-4">
                <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
                   <h2 className="text-2xl font-bold text-center mb-6 text-white flex justify-center items-center">
                     <Target className="w-6 h-6 mr-2 text-rodez-red" /> Entrenador Quotex
                   </h2>
                   <div className="space-y-6">
                     <div>
                       <label className="block text-sm font-medium text-gray-400 mb-2">Capital Total de Cuenta (USD)</label>
                       <input type="number" value={initialCapitalTemp} onChange={(e) => setInitialCapitalTemp(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white text-lg font-mono" placeholder="1000" />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-gray-400 mb-2">Inversión de Sesión (USD)</label>
                       <input type="number" value={sessionInvestmentTemp} onChange={(e) => setSessionInvestmentTemp(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white text-lg font-mono focus:border-rodez-red focus:outline-none transition-colors" placeholder="200" />
                     </div>
                     <button onClick={handleStartSession} className="w-full bg-rodez-red hover:bg-red-600 active:scale-95 text-white font-bold py-4 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-red-900/20">
                        <Play className="w-5 h-5 mr-2" /> INICIAR SESIÓN DE TRADING
                     </button>
                   </div>
                </div>
             </div>
           )
        ) : (
           /* OTHER HISTORICAL DAYS (OLD VIEW FOR PAST) */
           selectedDay ? (
             <div className="max-w-5xl mx-auto p-4 md:p-8">
               <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-800 pb-6 mb-6">
                  <div>
                    <h1 className="text-3xl font-bold text-white font-mono">{selectedDay.date}</h1>
                    <p className="text-gray-500 text-sm flex items-center mt-1">
                      <Clock className="w-4 h-4 mr-1" /> Historial de Operaciones
                    </p>
                  </div>
                  <div className="mt-4 md:mt-0 text-right flex items-center space-x-6">
                    <div>
                      <div className="text-xs text-gray-500 uppercase mb-1">Acertividad</div>
                      <div className="text-2xl font-bold text-white">{calculateWinRate(selectedDay)}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 uppercase mb-1">P/L Neto</div>
                      <div className={`text-4xl font-bold font-mono ${selectedDay.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedDay.pnl >= 0 ? '+' : ''}${selectedDay.pnl.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </header>
                
                {displayTrades.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayTrades.map((trade, idx) => (
                      <div key={trade.id} className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 group hover:border-gray-700 transition-all">
                         
                         {/* Optional Image View */}
                         {(trade.tradeImage.url || trade.tradeImage.base64) && trade.tradeImage.url !== '' ? (
                           <div className="mt-0 aspect-video bg-black cursor-pointer overflow-hidden relative" onClick={() => setViewTrade(trade)}>
                               <img src={trade.tradeImage.url || `data:${trade.tradeImage.mimeType};base64,${trade.tradeImage.base64}`} alt="Trade" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all" />
                               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Maximize2 className="text-white w-8 h-8 drop-shadow-lg" />
                               </div>
                               <div className="absolute top-2 right-2 flex space-x-2">
                                 <span className={`px-2 py-1 rounded text-xs font-bold flex items-center ${trade.outcome === 'WIN' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
                                   {trade.outcome === 'WIN' ? 'WIN' : 'LOSS'}
                                 </span>
                               </div>
                           </div>
                         ) : (
                           // Just a badge if no image
                           <div className="px-4 pt-4 flex justify-between items-center">
                             <span className="text-xs text-gray-500">#{displayTrades.length - idx}</span>
                             <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider flex items-center ${trade.outcome === 'WIN' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                               {trade.outcome}
                             </span>
                           </div>
                         )}

                         <div className="p-4 flex justify-between items-center bg-gray-900 border-t border-gray-800">
                           <div className="text-gray-400 font-mono text-sm">${trade.amountInvested} <span className="text-[10px] ml-1">({trade.payout}%)</span></div>
                           <div className={`font-mono text-lg font-bold ${trade.outcome === 'WIN' ? 'text-green-400' : 'text-red-400'}`}>
                             {trade.outcome === 'WIN' ? '+' : '-'}${trade.outcome === 'WIN' ? (trade.amountInvested * (trade.payout / 100)).toFixed(2) : trade.amountInvested.toFixed(2)}
                           </div>
                         </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 opacity-30">
                    <Crosshair className="w-16 h-16 mx-auto mb-4" />
                    <p className="text-xl">No hay operaciones registradas este día</p>
                  </div>
                )}
             </div>
          ) : (
             <div className="h-full flex flex-col items-center justify-center text-gray-600">
               <p>Selecciona un día en la línea de tiempo</p>
             </div>
          )
        )}
      </div>

       {/* LIGHTBOX / GALLERY MODAL FOR OLD TRADES */}
       {viewTrade && (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setViewTrade(null)}>
          <button onClick={() => setViewTrade(null)} className="absolute top-4 right-4 p-2 bg-gray-800 rounded-full text-white hover:bg-red-500 transition-colors z-50">
            <X size={24} />
          </button>
          
          <button onClick={(e) => { e.stopPropagation(); navigateTrade('prev'); }} disabled={displayTrades.indexOf(viewTrade) === 0} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-gray-800/50 hover:bg-rodez-red hover:text-white rounded-full transition-all disabled:opacity-0 z-50">
            <ChevronLeft size={32} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); navigateTrade('next'); }} disabled={displayTrades.indexOf(viewTrade) === displayTrades.length - 1} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-gray-800/50 hover:bg-rodez-red hover:text-white rounded-full transition-all disabled:opacity-0 z-50">
            <ChevronRight size={32} />
          </button>

          <div className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
             {
              (viewTrade.tradeImage.url || viewTrade.tradeImage.base64) && viewTrade.tradeImage.url !== '' && (
                 <img src={viewTrade.tradeImage.url || `data:${viewTrade.tradeImage.mimeType};base64,${viewTrade.tradeImage.base64}`} alt="Full View" className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl border border-gray-800 bg-black" />
              )
             }
             
             <div className="mt-6 flex flex-wrap items-center justify-center gap-4 bg-gray-900/80 px-8 py-4 rounded-full border border-gray-700 backdrop-blur-sm">
                <span className="text-gray-500 font-mono">${viewTrade.amountInvested}</span>
                <div className="w-px h-6 bg-gray-700"></div>
                <span className={`font-bold px-3 py-1 rounded ${viewTrade.outcome === 'WIN' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>{viewTrade.outcome}</span>
                <div className="w-px h-6 bg-gray-700"></div>
                <span className={`font-mono text-xl ${viewTrade.outcome === 'WIN' ? 'text-green-400' : 'text-red-400'}`}>
                   {viewTrade.outcome === 'WIN' ? '+' : '-'}${viewTrade.outcome === 'WIN' ? (viewTrade.amountInvested * (viewTrade.payout / 100)).toFixed(2) : viewTrade.amountInvested.toFixed(2)}
                </span>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};