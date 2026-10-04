import React, { useEffect, useRef, useState } from 'react';
import { generateTimelineData, getTodayString } from '../utils/dateHelper';
import { TradingDay, VisualTrade } from '../types';
import { StoryboardView } from './StoryboardView';
import {
  Clock,
  Activity,
  Crosshair,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  Calendar
} from 'lucide-react';

interface RodezViewProps {
  trades: VisualTrade[];
}

export const RodezView: React.FC<RodezViewProps> = ({ trades }) => {
  const [activeSubTab, setActiveSubTab] = useState<'storyboard' | 'history'>('storyboard');

  // Timeline & History State
  const [days, setDays] = useState<TradingDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<TradingDay | null>(null);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);
  const dateRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // View Image Lightbox State for History
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
    if (days.length > 0 && !hasScrolledToToday && activeSubTab === 'history') {
      const today = getTodayString();
      const element = dateRefs.current[today];
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHasScrolledToToday(true);
        }, 100);
      }
    }
  }, [days.length, hasScrolledToToday, activeSubTab]);

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

  return (
    <div className="flex flex-col h-full w-full bg-gray-950 text-gray-100 overflow-hidden relative">

      {/* TOP SUB-NAVIGATION TABS */}
      <div className="w-full bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveSubTab('storyboard')}
            className={`flex items-center px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'storyboard'
                ? 'bg-rodez-red text-white shadow-md shadow-red-900/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 mr-1.5" />
            <span>Storyboard Base (F11)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'history'
                ? 'bg-rodez-red text-white shadow-md shadow-red-900/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            <span>Calendario & Historial</span>
          </button>
        </div>
      </div>

      {/* TAB 1: STORYBOARD BASE VIEW */}
      {activeSubTab === 'storyboard' && (
        <div className="flex-1 min-h-0 w-full overflow-hidden">
          <StoryboardView />
        </div>
      )}

      {/* TAB 2: CALENDAR & TRADING HISTORY VIEW */}
      {activeSubTab === 'history' && (
        <div className="flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden relative">
          
          {/* LEFT COLUMN: TIMELINE */}
          <div className="w-full md:w-1/3 lg:w-1/4 border-r border-gray-800 flex flex-col h-1/3 md:h-full bg-gray-900/50 order-last md:order-first z-20">
            <div className="p-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm z-10 sticky top-0 flex justify-between items-center">
              <h2 className="text-xs font-bold flex items-center text-white uppercase tracking-wider">
                <Activity className="w-4 h-4 mr-2 text-rodez-red" />
                Calendario
              </h2>
              <span className="text-[10px] text-gray-500 font-mono">{days.length} días</span>
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
                        {day.date} {isToday ? '(Hoy)' : ''}
                      </span>
                    </div>
                    {hasActivity ? (
                      <div className="flex justify-between items-end">
                        <div className="text-[10px] text-gray-500">
                          {day.itm}W - {day.otm}L
                        </div>
                        <div className={`text-xs font-bold font-mono ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                          {day.pnl >= 0 ? '+' : ''}${day.pnl.toFixed(2)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-600 italic">Sin operaciones</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: DAY DETAILS & TRADES */}
          <div className="flex-1 h-full overflow-y-auto bg-gray-950 relative order-first md:order-last custom-scrollbar p-4 md:p-8">
            {selectedDay ? (
              <div className="max-w-5xl mx-auto">
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
            )}
          </div>
        </div>
      )}

      {/* LIGHTBOX FOR TRADES */}
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
            {(viewTrade.tradeImage.url || viewTrade.tradeImage.base64) && viewTrade.tradeImage.url !== '' && (
              <img src={viewTrade.tradeImage.url || `data:${viewTrade.tradeImage.mimeType};base64,${viewTrade.tradeImage.base64}`} alt="Full View" className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl border border-gray-800 bg-black" />
            )}

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