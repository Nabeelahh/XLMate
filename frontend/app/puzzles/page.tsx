"use client";

import React, { useState } from "react";
import { FaTrophy, FaStar, FaCheck, FaTimes, FaRedo, FaArrowLeft } from "react-icons/fa";

interface Puzzle {
  id: number;
  fen: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  description: string;
  solution: { from: string; to: string; promotion?: string }[];
  hint?: string;
}

// Mock puzzle data with FENs
const MOCK_PUZZLES: Puzzle[] = [
  {
    id: 1,
    fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
    title: "Fork Attack",
    difficulty: "easy",
    description: "Find the knight fork that wins material",
    solution: [{ from: "f3", to: "g5" }],
    hint: "Look for a knight move that attacks two pieces"
  },
  {
    id: 2,
    fen: "rnbqkb1r/pppp1ppp/5n2/2B1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
    title: "Pin and Win",
    difficulty: "medium",
    description: "Use a pin to create a winning advantage",
    solution: [{ from: "c4", to: "f7" }],
    hint: "The bishop can pin the knight to the king"
  },
  {
    id: 3,
    fen: "r1bqk2r/pppp1ppp/2n2n2/2B1p3/4P3/3N1N2/PPPP1PPP/R1BQK2R w KQkq - 0 6",
    title: "Discovered Attack",
    difficulty: "hard",
    description: "Execute a discovered attack for checkmate",
    solution: [{ from: "d3", to: "e5" }, { from: "c4", to: "f7" }],
    hint: "Move the knight first to reveal the bishop's attack"
  },
  {
    id: 4,
    fen: "rnbqkbnr/pp1ppppp/2p5/3p4/3P4/2N5/PP1PPPPP/R1BQKBNR w KQkq - 0 3",
    title: "Center Control",
    difficulty: "easy",
    description: "Control the center with your knight",
    solution: [{ from: "c3", to: "d5" }],
    hint: "Knights are excellent in the center"
  },
  {
    id: 5,
    fen: "rnbqk2r/pppp1ppp/5n2/2B1p3/3PP3/5N2/PPP2PPP/RNBQK2R w KQkq - 0 5",
    title: "Double Attack",
    difficulty: "medium",
    description: "Create a double attack with your bishop",
    solution: [{ from: "c4", to: "e6" }],
    hint: "Look for squares that attack multiple pieces"
  }
];

export default function PuzzlesPage() {
  const [selectedPuzzle, setSelectedPuzzle] = useState<Puzzle | null>(null);
  const [completedPuzzles, setCompletedPuzzles] = useState<Set<number>>(new Set());
  const [currentMove, setCurrentMove] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "text-green-400 bg-green-400/20 border-green-400/30";
      case "medium": return "text-yellow-400 bg-yellow-400/20 border-yellow-400/30";
      case "hard": return "text-red-400 bg-red-400/20 border-red-400/30";
      default: return "text-gray-400 bg-gray-400/20 border-gray-400/30";
    }
  };

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return <FaStar className="text-green-400" />;
      case "medium": return <FaStar className="text-yellow-400" />;
      case "hard": return <FaStar className="text-red-400" />;
      default: return <FaStar className="text-gray-400" />;
    }
  };

  const handlePuzzleSelect = (puzzle: Puzzle) => {
    setSelectedPuzzle(puzzle);
    setCurrentMove(0);
    setIsCorrect(null);
    setShowHint(false);
  };

  const handleSolutionSubmit = () => {
    if (!selectedPuzzle) return;

    // Simulate solution validation
    const isSolutionCorrect = currentMove === selectedPuzzle.solution.length - 1;
    setIsCorrect(isSolutionCorrect);

    if (isSolutionCorrect) {
      // Mark puzzle as completed
      setCompletedPuzzles(prev => new Set([...prev, selectedPuzzle.id]));
      
      // Simulate backend verification and reward
      const reward = 0.01; // 0.01 XLM reward
      setRewardAmount(reward);
      setShowReward(true);
      
      // Simulate backend API call
      console.log(`🎯 Puzzle ${selectedPuzzle.id} completed successfully!`);
      console.log(`📡 Simulating backend verification...`);
      console.log(`💰 Awarding ${reward} XLM to user wallet`);
      console.log(`✅ Backend verification complete - reward signed and ready to claim`);

      // Hide reward after 3 seconds
      setTimeout(() => {
        setShowReward(false);
      }, 3000);
    }
  };

  const handleMoveNext = () => {
    if (!selectedPuzzle) return;
    if (currentMove < selectedPuzzle.solution.length - 1) {
      setCurrentMove(currentMove + 1);
    } else {
      handleSolutionSubmit();
    }
  };

  const handleMoveBack = () => {
    if (currentMove > 0) {
      setCurrentMove(currentMove - 1);
      setIsCorrect(null);
    }
  };

  const handleReset = () => {
    setCurrentMove(0);
    setIsCorrect(null);
    setShowHint(false);
  };

  const completionRate = Math.round((completedPuzzles.size / MOCK_PUZZLES.length) * 100);

  if (selectedPuzzle) {
    return (
      <div className="min-h-screen bg-gray-900 p-4 md:p-8">
        {/* Reward Popup */}
        {showReward && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 p-8 rounded-2xl border border-green-400/30 text-center animate-bounce">
              <div className="flex flex-col items-center gap-4">
                <FaTrophy className="text-6xl text-yellow-400" />
                <h3 className="text-2xl font-bold text-green-400">Puzzle Complete!</h3>
                <p className="text-xl text-white">You earned +{rewardAmount} XLM</p>
                <div className="text-sm text-gray-300">
                  <p>✅ Backend verification complete</p>
                  <p>🎁 Reward ready to claim</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setSelectedPuzzle(null)}
            className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <FaArrowLeft />
            <span>Back to Puzzles</span>
          </button>

          {/* Puzzle Info */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">{selectedPuzzle.title}</h2>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getDifficultyColor(selectedPuzzle.difficulty)}`}>
                {getDifficultyIcon(selectedPuzzle.difficulty)}
                <span className="text-sm font-medium capitalize">{selectedPuzzle.difficulty}</span>
              </div>
            </div>
            <p className="text-gray-300 mb-4">{selectedPuzzle.description}</p>
            
            {/* Progress */}
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>Move {currentMove + 1} of {selectedPuzzle.solution.length}</span>
              <div className="flex-1 bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentMove + 1) / selectedPuzzle.solution.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Chess Board Placeholder */}
          <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 mb-6">
            <div className="aspect-square bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">♔</div>
                <p className="text-gray-700 font-medium">Chess Board</p>
                <p className="text-sm text-gray-600 mt-2">FEN: {selectedPuzzle.fen}</p>
                <div className="mt-4 p-3 bg-white/80 rounded-lg">
                  <p className="text-sm font-mono">
                    Current Move: {selectedPuzzle.solution[currentMove]?.from} → {selectedPuzzle.solution[currentMove]?.to}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <button
                  onClick={handleMoveBack}
                  disabled={currentMove === 0}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-white font-medium transition-colors"
                >
                  <FaTimes className="inline mr-2" />
                  Back
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
                >
                  <FaRedo className="inline mr-2" />
                  Reset
                </button>
                <button
                  onClick={() => setShowHint(!showHint)}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-400 font-medium transition-colors"
                >
                  💡 Hint
                </button>
              </div>

              <button
                onClick={handleMoveNext}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg text-white font-bold transition-all duration-300 transform hover:scale-105"
              >
                {currentMove === selectedPuzzle.solution.length - 1 ? (
                  <>
                    <FaCheck className="inline mr-2" />
                    Submit Solution
                  </>
                ) : (
                  <>
                    Next Move →
                  </>
                )}
              </button>
            </div>

            {/* Hint Display */}
            {showHint && selectedPuzzle.hint && (
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-blue-400 text-sm">
                  💡 {selectedPuzzle.hint}
                </p>
              </div>
            )}

            {/* Result Display */}
            {isCorrect !== null && (
              <div className={`mt-4 p-4 rounded-lg border ${
                isCorrect 
                  ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                <p className="font-medium">
                  {isCorrect ? '✅ Correct! Well done!' : '❌ Not quite right. Try again!'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            <FaTrophy className="inline mr-3 text-yellow-400" />
            Learn-to-Earn Puzzles
          </h1>
          <p className="text-xl text-gray-300 mb-6">
            Solve chess puzzles and earn micro XLM rewards!
          </p>
          
          {/* Stats */}
          <div className="flex justify-center gap-8 mb-8">
            <div className="bg-gray-800 px-6 py-3 rounded-xl border border-gray-700">
              <p className="text-2xl font-bold text-white">{completedPuzzles.size}</p>
              <p className="text-sm text-gray-400">Completed</p>
            </div>
            <div className="bg-gray-800 px-6 py-3 rounded-xl border border-gray-700">
              <p className="text-2xl font-bold text-white">{completionRate}%</p>
              <p className="text-sm text-gray-400">Completion Rate</p>
            </div>
            <div className="bg-gray-800 px-6 py-3 rounded-xl border border-gray-700">
              <p className="text-2xl font-bold text-green-400">{(completedPuzzles.size * 0.01).toFixed(2)}</p>
              <p className="text-sm text-gray-400">XLM Earned</p>
            </div>
          </div>
        </div>

        {/* Puzzle Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_PUZZLES.map((puzzle) => {
            const isCompleted = completedPuzzles.has(puzzle.id);
            return (
              <div
                key={puzzle.id}
                className={`bg-gray-800 p-6 rounded-xl border transition-all duration-300 hover:scale-105 cursor-pointer ${
                  isCompleted 
                    ? 'border-green-500/30 bg-green-500/5' 
                    : 'border-gray-700 hover:border-gray-600'
                }`}
                onClick={() => handlePuzzleSelect(puzzle)}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">{puzzle.title}</h3>
                  {isCompleted && <FaCheck className="text-green-400 text-xl" />}
                </div>
                
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm mb-3 ${getDifficultyColor(puzzle.difficulty)}`}>
                  {getDifficultyIcon(puzzle.difficulty)}
                  <span className="capitalize">{puzzle.difficulty}</span>
                </div>
                
                <p className="text-gray-300 text-sm mb-4">{puzzle.description}</p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Puzzle #{puzzle.id}</span>
                  <span className="text-xs text-green-400 font-medium">+0.01 XLM</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Instructions */}
        <div className="mt-12 bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">How to Play</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-gray-300">
            <div>
              <h4 className="font-semibold text-white mb-2">1. Select a Puzzle</h4>
              <p className="text-sm">Choose from puzzles of varying difficulty levels</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">2. Find the Solution</h4>
              <p className="text-sm">Navigate through the correct moves to solve the puzzle</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">3. Earn Rewards</h4>
              <p className="text-sm">Complete puzzles to earn 0.01 XLM each</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
