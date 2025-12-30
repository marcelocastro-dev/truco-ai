
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Player, GameState, PlayedCard, Suit, Rank, TrucoStatus, AppView, Room } from './types';
import { RANKS, SUITS, NEXT_RANK, RANK_POWER, MANILHA_SUIT_POWER } from './constants';
import CardUI from './components/CardUI';
import { getAIAction } from './services/geminiService';

const INITIAL_ROOMS: Room[] = [
  { id: 1, name: "Sala do Zap", playersCount: 1, capacity: 4 },
  { id: 2, name: "Mesa dos Mestres", playersCount: 2, capacity: 4 },
  { id: 3, name: "Truco Cego", playersCount: 0, capacity: 4 },
  { id: 4, name: "Resenha e Truco", playersCount: 1, capacity: 4 },
];

const RANDOM_NAMES = ["Carlos_BR", "TrucoMaster", "Vitoria77", "ZapMan", "ReiDoTruco", "Gamer_NTC", "Lucas_2024", "Mari_Truco", "BluffExpert"];

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('lobby');
  const [userName, setUserName] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<{name: string, isAI: boolean}[]>([]);
  const [countdown, setCountdown] = useState(60);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);

  // Reference for the timer to clean up
  const timerRef = useRef<any>(null);

  const createDeck = (): Card[] => {
    const deck: Card[] = [];
    RANKS.forEach(rank => {
      SUITS.forEach(suit => {
        deck.push({ rank, suit, id: `${rank}-${suit}-${Math.random()}` });
      });
    });
    return deck.sort(() => Math.random() - 0.5);
  };

  const startNewHand = useCallback((prevScores?: [number, number], dealerIdx: number = 0, names?: {name: string, isAI: boolean}[]) => {
    const fullDeck = createDeck();
    
    // Use names from room or default to Gemini bots if not provided
    const finalPlayers: Player[] = names ? names.map((p, i) => ({
      id: i,
      name: p.name,
      isAI: p.isAI,
      hand: [],
      team: i % 2 === 0 ? 0 : 1
    })) : [
      { id: 0, name: userName || "Você", isAI: false, hand: [], team: 0 },
      { id: 1, name: "Gemini Pro", isAI: true, hand: [], team: 1 },
      { id: 2, name: "Gemini Amigo", isAI: true, hand: [], team: 0 },
      { id: 3, name: "Gemini Flash", isAI: true, hand: [], team: 1 },
    ];

    for (let i = 0; i < 3; i++) {
      finalPlayers.forEach(p => {
        const card = fullDeck.pop();
        if (card) p.hand.push(card);
      });
    }

    const vira = fullDeck.pop()!;
    const manilhaRank = NEXT_RANK[vira.rank];

    setGameState({
      players: finalPlayers,
      deck: fullDeck,
      vira,
      manilhaRank,
      currentTurn: (dealerIdx + 1) % 4,
      playedCards: [],
      roundResults: [],
      teamScores: prevScores || [0, 0],
      trucoValue: 1,
      trucoChallenger: null,
      waitingForTrucoResponse: false,
      dealer: dealerIdx,
      message: "Partida iniciada! É a vez de " + finalPlayers[(dealerIdx + 1) % 4].name,
      isGameOver: false,
    });
  }, [userName]);

  const handleJoinRoom = (room: Room) => {
    setSelectedRoom(room);
    setRoomPlayers([{ name: userName, isAI: false }]);
    setCountdown(60);
    setView('waiting');
  };

  // Waiting Room Logic: Simulated joining
  useEffect(() => {
    if (view === 'waiting') {
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            // Time out: Fill remaining with Bots and start
            const currentPlayers = [...roomPlayers];
            while (currentPlayers.length < 4) {
              currentPlayers.push({ name: `Gemini Bot ${currentPlayers.length}`, isAI: true });
            }
            setRoomPlayers(currentPlayers);
            setView('game');
            startNewHand([0, 0], 0, currentPlayers);
            return 0;
          }
          return prev - 1;
        });

        // Chance to simulate a real player joining
        if (roomPlayers.length < 4 && Math.random() < 0.15) {
          const randomName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
          if (!roomPlayers.find(p => p.name === randomName)) {
            setRoomPlayers(prev => {
              const next = [...prev, { name: randomName, isAI: false }];
              if (next.length === 4) {
                clearInterval(timerRef.current);
                setTimeout(() => {
                  setView('game');
                  startNewHand([0, 0], 0, next);
                }, 1500);
              }
              return next;
            });
          }
        }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [view, roomPlayers, userName, startNewHand]);

  const getCardStrength = (card: Card, manilhaRank: Rank): number => {
    if (card.rank === manilhaRank) return 100 + MANILHA_SUIT_POWER[card.suit];
    return RANK_POWER[card.rank];
  };

  const evaluateMiniRound = (cards: PlayedCard[], manilhaRank: Rank): number => {
    let winnerId = cards[0].playerId;
    let maxStrength = getCardStrength(cards[0].card, manilhaRank);
    let tie = false;

    for (let i = 1; i < cards.length; i++) {
      const strength = getCardStrength(cards[i].card, manilhaRank);
      if (strength > maxStrength) {
        maxStrength = strength;
        winnerId = cards[i].playerId;
        tie = false;
      } else if (strength === maxStrength) tie = true;
    }
    return tie ? -1 : gameState!.players[winnerId].team;
  };

  const handleNextTurn = useCallback(async (currentGS: GameState) => {
    if (currentGS.isGameOver) return;
    const currentPlayer = currentGS.players[currentGS.currentTurn];

    if (currentPlayer.isAI && !currentGS.waitingForTrucoResponse) {
      setIsAILoading(true);
      await new Promise(r => setTimeout(r, 1200));
      const aiDecision = await getAIAction(currentGS, currentPlayer);
      setIsAILoading(false);

      if (aiDecision.action === 'truco') callTruco();
      else if (aiDecision.action === 'play') {
        const cardIdx = aiDecision.cardIndex ?? 0;
        playCard(currentGS.currentTurn, currentGS.players[currentGS.currentTurn].hand[cardIdx]);
      }
    } else if (currentGS.waitingForTrucoResponse) {
      const nextResponder = (currentGS.trucoChallenger! + 1) % 4;
      const responder = currentGS.players[nextResponder];
      if (responder.isAI) {
        setIsAILoading(true);
        await new Promise(r => setTimeout(r, 1200));
        const aiDecision = await getAIAction(currentGS, responder);
        setIsAILoading(false);
        aiDecision.action === 'accept' ? acceptTruco() : refuseTruco();
      }
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState && gameState.players[gameState.currentTurn].isAI && !gameState.isGameOver) {
      handleNextTurn(gameState);
    }
  }, [gameState?.currentTurn, gameState?.waitingForTrucoResponse]);

  const playCard = (playerId: number, card: Card) => {
    if (!gameState || gameState.waitingForTrucoResponse || gameState.isGameOver) return;
    if (gameState.currentTurn !== playerId) return;

    const newPlayers = gameState.players.map(p => p.id === playerId ? { ...p, hand: p.hand.filter(c => c.id !== card.id) } : p);
    const newPlayedCards = [...gameState.playedCards, { playerId, card }];

    if (newPlayedCards.length === 4) {
      const winnerTeam = evaluateMiniRound(newPlayedCards, gameState.manilhaRank!);
      const newRoundResults = [...gameState.roundResults, winnerTeam];
      
      let handWinnerTeam: number | null = null;
      if (newRoundResults.length >= 2) {
        const t0 = newRoundResults.filter(r => r === 0).length;
        const t1 = newRoundResults.filter(r => r === 1).length;
        if (t0 >= 2) handWinnerTeam = 0;
        else if (t1 >= 2) handWinnerTeam = 1;
        else if (newRoundResults.length === 3) {
          if (t0 > t1) handWinnerTeam = 0;
          else if (t1 > t0) handWinnerTeam = 1;
          else handWinnerTeam = newRoundResults[0] === -1 ? (newRoundResults[1] === -1 ? (newRoundResults[2] === -1 ? 0 : newRoundResults[2]) : newRoundResults[1]) : newRoundResults[0];
        }
      }

      if (handWinnerTeam !== null) {
        const newScores: [number, number] = [...gameState.teamScores] as [number, number];
        newScores[handWinnerTeam] += gameState.trucoValue === 1 ? 1 : gameState.trucoValue;
        const isGameFinished = newScores[0] >= 12 || newScores[1] >= 12;
        setGameState(prev => ({ ...prev!, players: newPlayers, playedCards: newPlayedCards, roundResults: newRoundResults, teamScores: newScores, message: `Time ${handWinnerTeam + 1} venceu a mão!`, isGameOver: isGameFinished }));
        if (!isGameFinished) setTimeout(() => startNewHand(newScores, (gameState.dealer + 1) % 4, gameState.players), 2500);
      } else {
        const miniRoundWinnerId = newPlayedCards.reduce((prev, curr) => getCardStrength(curr.card, gameState.manilhaRank!) > getCardStrength(prev.card, gameState.manilhaRank!) ? curr : prev).playerId;
        setTimeout(() => {
          setGameState(prev => ({ ...prev!, players: newPlayers, playedCards: [], roundResults: newRoundResults, currentTurn: miniRoundWinnerId, message: `Rodada vencida. Turno de ${prev!.players[miniRoundWinnerId].name}` }));
        }, 1500);
      }
    } else {
      setGameState(prev => ({ ...prev!, players: newPlayers, playedCards: newPlayedCards, currentTurn: (prev!.currentTurn + 1) % 4, message: `Turno de ${prev!.players[(prev!.currentTurn + 1) % 4].name}` }));
    }
  };

  const callTruco = () => {
    if (!gameState || gameState.waitingForTrucoResponse || gameState.isGameOver) return;
    setGameState(prev => ({ ...prev!, waitingForTrucoResponse: true, trucoChallenger: prev!.currentTurn, message: `${prev!.players[prev!.currentTurn].name} chamou TRUCO!` }));
  };

  const acceptTruco = () => setGameState(prev => ({ ...prev!, trucoValue: (prev!.trucoValue === 1 ? 3 : prev!.trucoValue + 3) as TrucoStatus, waitingForTrucoResponse: false, message: "Truco aceito!" }));
  const refuseTruco = () => {
    const challengerTeam = gameState!.players[gameState!.trucoChallenger!].team;
    const newScores: [number, number] = [...gameState!.teamScores] as [number, number];
    newScores[challengerTeam] += gameState!.trucoValue;
    const isGameFinished = newScores[0] >= 12 || newScores[1] >= 12;
    setGameState(prev => ({ ...prev!, teamScores: newScores, isGameOver: isGameFinished, waitingForTrucoResponse: false, message: `Desistiram! Time ${challengerTeam + 1} ganha.` }));
    if (!isGameFinished) setTimeout(() => startNewHand(newScores, (gameState!.dealer + 1) % 4, gameState.players), 2500);
  };

  // --- Render Views ---

  if (view === 'lobby') {
    return (
      <div className="h-screen w-full bg-emerald-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-emerald-900/50 backdrop-blur-xl p-8 rounded-3xl border border-emerald-400/20 shadow-2xl text-center">
          <div className="mb-8">
            <div className="w-20 h-20 bg-yellow-400 rounded-full mx-auto flex items-center justify-center shadow-lg mb-4">
              <i className="fa-solid fa-spade text-emerald-950 text-4xl"></i>
            </div>
            <h1 className="text-4xl font-black text-white italic tracking-tight">TRUCO MASTER</h1>
            <p className="text-emerald-400/60 font-bold uppercase text-xs tracking-widest mt-1">Brazilian High Stakes</p>
          </div>
          
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Digite seu nome..." 
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full bg-black/30 border-2 border-emerald-400/20 rounded-2xl px-6 py-4 text-white font-bold placeholder:text-emerald-400/30 focus:outline-none focus:border-yellow-400/50 transition-all"
            />
            <button 
              onClick={() => userName && setView('rooms')}
              disabled={!userName}
              className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-emerald-950 font-black py-4 rounded-2xl shadow-xl transition-all transform hover:scale-105 active:scale-95"
            >
              ENTRAR NO LOBBY
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'rooms') {
    return (
      <div className="h-screen w-full bg-emerald-950 flex flex-col p-6 overflow-y-auto">
        <header className="flex justify-between items-center mb-10 max-w-5xl mx-auto w-full">
          <div>
            <h2 className="text-white text-3xl font-black italic uppercase">Salas de Truco</h2>
            <p className="text-emerald-400/60 font-bold text-sm">Olá, {userName}!</p>
          </div>
          <button onClick={() => setView('lobby')} className="text-white/40 hover:text-white transition-colors">Sair</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto w-full">
          {INITIAL_ROOMS.map(room => (
            <div 
              key={room.id}
              onClick={() => handleJoinRoom(room)}
              className="bg-emerald-900/40 border-2 border-white/5 hover:border-yellow-400/40 p-6 rounded-3xl cursor-pointer transition-all group relative overflow-hidden"
            >
              <div className="absolute -right-4 -bottom-4 opacity-5 text-8xl text-white">
                <i className="fa-solid fa-cards"></i>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-white text-xl font-black mb-1">{room.name}</h3>
                  <p className="text-emerald-400 text-sm font-bold">{room.playersCount}/4 Jogadores</p>
                </div>
                <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-white">
                  Disponível
                </div>
              </div>
              <div className="mt-8 flex justify-between items-center">
                 <div className="flex -space-x-2">
                    {[...Array(room.playersCount)].map((_, i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-emerald-700 border-2 border-emerald-900 flex items-center justify-center text-[10px] text-white">
                        <i className="fa-solid fa-user"></i>
                      </div>
                    ))}
                 </div>
                 <span className="text-yellow-400 font-black group-hover:translate-x-2 transition-transform uppercase italic tracking-wider">Jogar Agora <i className="fa-solid fa-arrow-right ml-2"></i></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'waiting') {
    return (
      <div className="h-screen w-full bg-emerald-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center">
          <h2 className="text-white text-4xl font-black mb-2 italic uppercase">Aguardando Jogadores</h2>
          <p className="text-emerald-400/60 font-bold mb-8 uppercase tracking-widest text-sm">{selectedRoom?.name}</p>
          
          <div className="flex justify-center items-center gap-8 mb-12">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-emerald-900/40" />
                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * countdown / 60)} className="text-yellow-400 transition-all duration-1000" />
              </svg>
              <span className="absolute text-2xl font-black text-white">{countdown}s</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[...Array(4)].map((_, i) => {
              const p = roomPlayers[i];
              return (
                <div key={i} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center aspect-square transition-all duration-500 ${p ? 'bg-emerald-800 border-yellow-400/50' : 'bg-black/20 border-white/5 border-dashed'}`}>
                  {p ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center mb-2 shadow-lg">
                        <i className="fa-solid fa-user text-emerald-950"></i>
                      </div>
                      <span className="text-white text-xs font-black truncate w-full px-1 uppercase">{p.name}</span>
                      <span className="text-[8px] text-emerald-400 font-bold uppercase mt-1">Pronto</span>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full border-2 border-white/10 flex items-center justify-center mb-2 animate-pulse">
                         <i className="fa-solid fa-spinner fa-spin text-white/20"></i>
                      </div>
                      <span className="text-white/20 text-[10px] font-bold uppercase">Entrando...</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <button 
            onClick={() => setView('rooms')}
            className="text-white/40 hover:text-red-500 font-black text-xs uppercase tracking-widest transition-colors"
          >
            Cancelar e Sair da Sala
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  return (
    <div className="relative h-screen w-full bg-emerald-900 overflow-hidden flex flex-col font-montserrat">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="grid grid-cols-12 h-full w-full">
          {[...Array(48)].map((_, i) => (
            <div key={i} className="flex items-center justify-center border-[0.5px] border-white text-4xl">
              <i className={`fa-solid fa-${['clover', 'heart', 'spade', 'diamond'][i % 4]}`}></i>
            </div>
          ))}
        </div>
      </div>

      <div className="z-10 bg-black/40 backdrop-blur-md p-4 flex justify-between items-center border-b border-white/10 shadow-xl">
        <div className="flex gap-8">
          <div className="flex flex-col items-center">
            <span className="text-xs text-emerald-200 uppercase font-black">Nós (T1)</span>
            <span className="text-3xl text-white font-black">{gameState.teamScores[0]}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-emerald-200 uppercase font-black">Eles (T2)</span>
            <span className="text-3xl text-white font-black">{gameState.teamScores[1]}</span>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col items-center px-4">
          <div className="text-yellow-400 font-black text-xl tracking-widest uppercase">
            {gameState.trucoValue === 1 ? 'MÃO NORMAL' : `VALENDO ${gameState.trucoValue}`}
          </div>
          <div className="text-white/80 text-sm font-semibold truncate max-w-xs md:max-w-md">
            {selectedRoom?.name}: {gameState.message}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setView('rooms')} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-[10px] font-black shadow-lg uppercase">Sair</button>
        </div>
      </div>

      <div className="flex-1 relative p-4 flex items-center justify-center">
        <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
           <span className="text-white/60 text-[10px] font-black uppercase tracking-widest">Vira</span>
           <CardUI card={gameState.vira!} />
        </div>

        <div className="w-full h-full max-w-4xl max-h-[600px] relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <PlayerTag player={gameState.players[2]} isActive={gameState.currentTurn === 2} isWaiting={gameState.waitingForTrucoResponse && gameState.trucoChallenger === 2} />
            <div className="flex -space-x-12 scale-75">
              {gameState.players[2].hand.map((c, i) => <CardUI key={c.id} hidden className="rotate-180" />)}
            </div>
          </div>

          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-row items-center gap-4">
            <PlayerTag player={gameState.players[3]} isActive={gameState.currentTurn === 3} isWaiting={gameState.waitingForTrucoResponse && gameState.trucoChallenger === 3} />
            <div className="flex flex-col -space-y-16 scale-75">
              {gameState.players[3].hand.map((c, i) => <CardUI key={c.id} hidden className="rotate-90" />)}
            </div>
          </div>

          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-row-reverse items-center gap-4">
            <PlayerTag player={gameState.players[1]} isActive={gameState.currentTurn === 1} isWaiting={gameState.waitingForTrucoResponse && gameState.trucoChallenger === 1} />
            <div className="flex flex-col -space-y-16 scale-75">
              {gameState.players[1].hand.map((c, i) => <CardUI key={c.id} hidden className="-rotate-90" />)}
            </div>
          </div>

          <div className="absolute inset-0 m-auto w-64 h-64 bg-emerald-800/50 rounded-full border-4 border-dashed border-emerald-600/50 flex items-center justify-center">
            {gameState.playedCards.map((pc, i) => {
               const offsets = ['translate-y-8', '-translate-x-8', '-translate-y-8', 'translate-x-8'];
               return (
                 <div key={pc.card.id} className={`absolute transition-all duration-500 scale-90 ${offsets[pc.playerId]}`}>
                    <CardUI card={pc.card} isManilha={pc.card.rank === gameState.manilhaRank} />
                 </div>
               );
            })}
            {isAILoading && <div className="z-50 bg-black/60 px-4 py-2 rounded-full text-white text-[10px] font-bold animate-pulse uppercase tracking-widest">Oponente pensando...</div>}
          </div>

          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
            <div className="flex -space-x-8 hover:-space-x-4 transition-all">
              {gameState.players[0].hand.map((c, i) => (
                <CardUI key={c.id} card={c} isManilha={c.rank === gameState.manilhaRank} onClick={() => playCard(0, c)} disabled={gameState.currentTurn !== 0 || gameState.waitingForTrucoResponse} />
              ))}
            </div>
            <PlayerTag player={gameState.players[0]} isActive={gameState.currentTurn === 0} />
          </div>
        </div>
      </div>

      <div className="z-10 h-24 bg-black/30 backdrop-blur-xl border-t border-white/10 flex items-center justify-center gap-4 px-6">
        {gameState.waitingForTrucoResponse && (gameState.trucoChallenger === 1 || gameState.trucoChallenger === 3) ? (
          <div className="flex gap-4 items-center">
            <span className="text-white font-black animate-bounce mr-4 uppercase italic tracking-wider">Desafiado! Aceita?</span>
            <button onClick={acceptTruco} className="bg-emerald-500 hover:bg-emerald-600 text-white px-10 py-3 rounded-xl font-black shadow-lg active:scale-95 uppercase">Aceito</button>
            <button onClick={refuseTruco} className="bg-red-500 hover:bg-red-600 text-white px-10 py-3 rounded-xl font-black shadow-lg active:scale-95 uppercase">Fugir</button>
          </div>
        ) : (
          <button 
            onClick={callTruco}
            disabled={gameState.currentTurn !== 0 || gameState.waitingForTrucoResponse || gameState.trucoValue >= 12}
            className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-30 text-emerald-950 px-14 py-4 rounded-2xl font-black text-2xl shadow-2xl transition-all transform hover:-translate-y-1 active:scale-95 uppercase italic tracking-tighter"
          >
            {gameState.trucoValue === 1 ? 'TRUCO!' : gameState.trucoValue === 3 ? 'SEIS!' : gameState.trucoValue === 6 ? 'NOVE!' : 'DOZE!'}
          </button>
        )}
      </div>

      {gameState.isGameOver && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6">
          <h1 className="text-7xl font-black text-white mb-2 italic uppercase">Fim de Jogo</h1>
          <p className="text-3xl font-bold text-yellow-400 mb-12 uppercase tracking-widest">
            {gameState.teamScores[0] >= 12 ? 'Vitória do seu Time!' : 'Vitória do Time Adversário!'}
          </p>
          <div className="flex gap-16 mb-16">
             <div className="flex flex-col items-center"><p className="text-white/40 text-xs font-black mb-2 uppercase tracking-tighter">Sua Equipe</p><p className="text-7xl text-white font-black">{gameState.teamScores[0]}</p></div>
             <div className="flex flex-col items-center"><p className="text-white/40 text-xs font-black mb-2 uppercase tracking-tighter">Oponentes</p><p className="text-7xl text-white font-black">{gameState.teamScores[1]}</p></div>
          </div>
          <button onClick={() => setView('rooms')} className="bg-yellow-400 text-emerald-950 px-14 py-5 rounded-full text-2xl font-black shadow-2xl hover:scale-110 transition-transform uppercase tracking-wider">Voltar ao Lobby</button>
        </div>
      )}
    </div>
  );
};

const PlayerTag: React.FC<{ player: Player; isActive: boolean; isWaiting?: boolean }> = ({ player, isActive, isWaiting }) => {
  return (
    <div className={`flex flex-col items-center transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-60 scale-90'}`}>
      <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center mb-1 ${isActive ? 'bg-yellow-400 border-yellow-200' : 'bg-emerald-800 border-emerald-600'}`}>
        <i className={`fa-solid ${player.isAI ? 'fa-robot' : 'fa-user'} ${isActive ? 'text-emerald-950' : 'text-emerald-300'}`}></i>
      </div>
      <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-yellow-400' : 'text-white/70'} truncate max-w-[80px]`}>
        {player.name}
      </span>
      {isActive && <div className="mt-1 w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>}
      {isWaiting && <div className="mt-1 px-2 py-0.5 bg-red-500 text-[8px] text-white rounded-full animate-pulse font-bold uppercase tracking-tight">Trucou!</div>}
    </div>
  );
};

export default App;
