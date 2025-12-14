import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, X, Tomato } from './Icons';

export const PomodoroTimer = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Posição inicial no canto superior direito
  const [position, setPosition] = useState({ x: window.innerWidth - 180, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  
  const dragStartPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // Ajuste responsivo inicial
  useEffect(() => {
    const handleResize = () => {
        const isMobile = window.innerWidth < 768;
        setPosition({ 
            x: isMobile ? window.innerWidth - 80 : window.innerWidth - 200, 
            y: isMobile ? window.innerHeight - 150 : 120 
        });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSetTime = (minutes: number) => {
    setTimeLeft(minutes * 60);
    setIsRunning(false);
  };

  const toggleTimer = () => setIsRunning(!isRunning);
  
  const resetTimer = () => {
    setIsRunning(false);
    handleSetTime(25);
  };

  // --- LÓGICA DE ARRASTAR (GPU ACELERADA) ---

  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    hasMoved.current = false;
    dragStartPos.current = { x: clientX - position.x, y: clientY - position.y };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    hasMoved.current = true;
    let newX = clientX - dragStartPos.current.x;
    let newY = clientY - dragStartPos.current.y;
    const maxX = window.innerWidth - 60; 
    const maxY = window.innerHeight - 60;
    setPosition({ x: Math.max(0, Math.min(newX, maxX)), y: Math.max(0, Math.min(newY, maxY)) });
  };

  const handleDragEnd = () => setIsDragging(false);

  useEffect(() => {
      const onMouseMove = (e: MouseEvent) => { if (isDragging) { e.preventDefault(); handleDragMove(e.clientX, e.clientY); } };
      const onMouseUp = () => { if (isDragging) handleDragEnd(); };
      if (isDragging) { window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp); }
      return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [isDragging]);

  const onMouseDown = (e: React.MouseEvent) => { if (e.button === 0) handleDragStart(e.clientX, e.clientY); };
  const onTouchStart = (e: React.TouchEvent) => { handleDragStart(e.touches[0].clientX, e.touches[0].clientY); };
  const onTouchMove = (e: React.TouchEvent) => { handleDragMove(e.touches[0].clientX, e.touches[0].clientY); };
  const handleClick = () => { if (!hasMoved.current) setIsOpen(!isOpen); };

  const containerStyle: React.CSSProperties = {
      position: 'fixed', left: 0, top: 0,
      transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      touchAction: 'none', willChange: 'transform', zIndex: 100,
  };

  const DragTooltip = () => (
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-3 py-1 rounded-full whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
          Arraste para onde quiser
      </div>
  );

  // --- MODO MINIMIZADO (CÁPSULA DE VIDRO) ---
  if (!isOpen) {
    return (
      <div 
        onMouseDown={onMouseDown} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={handleDragEnd} onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}
        style={containerStyle}
        className={`
            group cursor-move select-none flex items-center justify-center
            transition-all duration-300 ease-out active:scale-95
            
            /* EFEITO LIQUID GLASS */
            bg-gradient-to-br from-white/60 to-white/30 
            backdrop-blur-md border border-white/40
            shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]
            
            ${isRunning 
                ? 'rounded-full px-4 py-2 gap-3 hover:shadow-[0_8px_32px_0_rgba(99,102,241,0.2)]' 
                : 'rounded-full w-14 h-14 hover:w-16 hover:h-16' // Efeito "Liquid" ao passar mouse
            }
        `}
        title="Pomodoro Focus"
      >
        <div className="relative flex items-center justify-center">
            {/* Ícone sutilmente brilhante */}
            <Tomato className={`drop-shadow-sm transition-transform duration-500 ${isRunning ? 'w-5 h-5' : 'w-7 h-7 group-hover:rotate-12'}`} />
        </div>
        
        {isRunning && (
            <span className="font-mono font-bold text-sm text-slate-800/80 tabular-nums tracking-wide">
                {formatTime(timeLeft)}
            </span>
        )}

        {!isDragging && showTooltip && <DragTooltip />}
      </div>
    );
  }

  // --- MODO EXPANDIDO (PAINEL DE VIDRO) ---
  return (
     <div 
        style={containerStyle}
        className="
            w-72 p-5 rounded-[2rem]
            
            /* EFEITO LIQUID GLASS PREMIUM */
            bg-gradient-to-br from-white/70 via-white/40 to-white/20
            backdrop-blur-xl 
            border border-white/50
            shadow-[0_8px_32px_0_rgba(31,38,135,0.1)]
            
            flex flex-col gap-6
            animate-in zoom-in-95 duration-300 ease-out
        "
     >
        {/* Header Glass */}
        <div 
            onMouseDown={onMouseDown} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={handleDragEnd}
            className="flex justify-between items-center cursor-move select-none group"
        >
            <div className="flex items-center gap-2 pointer-events-none opacity-60">
                <Tomato className="w-4 h-4" />
                <span className="text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Focus</span>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-white/30 transition-colors"
            >
                <X className="w-4 h-4"/>
            </button>
        </div>

        {/* Timer Display */}
        <div className="text-center select-none relative">
            {/* Círculo decorativo de fundo para dar profundidade */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/20 rounded-full blur-2xl -z-10"></div>

            <div className={`text-6xl font-mono font-bold tracking-tighter tabular-nums mb-6 transition-colors drop-shadow-sm ${isRunning ? 'text-indigo-600/90' : 'text-slate-700/80'}`}>
                {formatTime(timeLeft)}
            </div>
            
            {/* Liquid Buttons */}
            <div className="flex justify-center gap-6">
                <button 
                    onClick={toggleTimer} 
                    className={`
                        w-16 h-16 rounded-full flex items-center justify-center 
                        shadow-lg transition-all duration-300 active:scale-90 border
                        backdrop-blur-sm group
                        ${isRunning 
                            ? 'bg-amber-100/80 border-amber-200 text-amber-600 hover:bg-amber-200' 
                            : 'bg-indigo-600/90 border-indigo-500/50 text-white hover:bg-indigo-700 hover:shadow-indigo-300/50'
                        }
                    `}
                >
                    {isRunning ? <Pause className="w-6 h-6 fill-current"/> : <Play className="w-7 h-7 fill-current ml-1 group-hover:scale-110 transition-transform"/>}
                </button>
                
                <button 
                    onClick={resetTimer} 
                    className="
                        w-16 h-16 rounded-full flex items-center justify-center 
                        bg-white/40 border border-white/60 text-slate-600 
                        hover:bg-white/60 hover:text-indigo-600
                        shadow-md transition-all active:scale-90 backdrop-blur-sm
                    "
                    title="Reiniciar"
                >
                    <RefreshCw className="w-6 h-6"/>
                </button>
            </div>
        </div>

        {/* Presets Glass */}
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/20">
            {[
                { m: 25, label: '25m' },
                { m: 5, label: '5m' },
                { m: 15, label: '15m' }
            ].map((preset) => (
                <button 
                    key={preset.m}
                    onClick={() => handleSetTime(preset.m)} 
                    className={`
                        py-2 rounded-xl text-xs font-bold transition-all duration-200
                        border border-transparent hover:border-white/40
                        bg-white/20 hover:bg-white/50 text-slate-600
                        hover:shadow-sm
                    `}
                >
                    {preset.label}
                </button>
            ))}
        </div>
     </div>
  );
};