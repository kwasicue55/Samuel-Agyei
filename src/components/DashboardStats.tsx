import React from "react";
import { Award, BookOpen, Brain, CheckCircle } from "lucide-react";
import { QuickStats } from "../types";

interface DashboardStatsProps {
  stats: QuickStats;
  totalDocuments: number;
}

export default function DashboardStats({ stats, totalDocuments }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
      {/* Total Material Card */}
      <div 
        id="stat-docs" 
        className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all shadow-xl flex items-center gap-4"
      >
        <div className="p-3 bg-blue-500/15 text-blue-400 rounded-xl">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Loaded Materials</span>
          <span className="font-display font-bold text-2xl text-white block mt-0.5" id="val-docs">
            {totalDocuments} {totalDocuments === 1 ? "Subject" : "Subjects"}
          </span>
        </div>
      </div>

      {/* Flashcards Mastered Card */}
      <div 
        id="stat-flashcards" 
        className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all shadow-xl flex items-center gap-4"
      >
        <div className="p-3 bg-emerald-500/15 text-emerald-400 rounded-xl">
          <CheckCircle className="w-6 h-6" />
        </div>
        <div>
          <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Flashcards Mastered</span>
          <span className="font-display font-bold text-2xl text-white block mt-0.5" id="val-mastered">
            {stats.totalFlashcardsMastered} Card{stats.totalFlashcardsMastered === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Average Quiz Score Card */}
      <div 
        id="stat-quiz-score" 
        className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all shadow-xl flex items-center gap-4"
      >
        <div className="p-3 bg-amber-500/15 text-amber-400 rounded-xl">
          <Award className="w-6 h-6" />
        </div>
        <div>
          <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Average Quiz Accuracy</span>
          <span className="font-display font-bold text-2xl text-white block mt-0.5" id="val-score">
            {stats.averageQuizScore > 0 ? `${stats.averageQuizScore}% Correct` : "No quizzes taken"}
          </span>
        </div>
      </div>
    </div>
  );
}
