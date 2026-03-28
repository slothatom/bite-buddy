import { X, Flame, Zap, Trophy, Lock } from 'lucide-react'
import { useUserStore, XP_PER_LEVEL } from '../../store/useUserStore'

interface Props { onClose: () => void }

export default function ProgressInfoModal({ onClose }: Props) {
  const { profile, allAchievements, xpProgress } = useUserStore()
  const progress = xpProgress()
  const unlockedIds = new Set(profile.achievements.map((a) => a.id))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-900">Your Progress</h2>
          <button onClick={onClose} className="btn-ghost btn-icon"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* Level + XP */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-xl bg-xp-100 flex items-center justify-center">
                <Zap size={14} className="text-xp-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">Level {profile.level}</h3>
              <span className="ml-auto text-xs text-gray-400 font-mono">{profile.xp} XP total</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-xp-400 to-xp-600 h-2.5 rounded-full transition-all"
                style={{ width: `${Math.min(progress.progress * 100, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {progress.current} / {progress.needed} XP to Level {profile.level + 1}
              &nbsp;·&nbsp; {XP_PER_LEVEL} XP per level
            </p>
          </section>

          {/* Streak */}
          <section className="bg-amber-50 rounded-xl px-4 py-3 flex items-start gap-3">
            <Flame size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-gray-900">{profile.streak}-day streak</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Add at least one meal every day to keep your streak alive. Missing a day resets it to 1.
                Reach 3 days for the <strong>🔥 3-Day Streak</strong> badge, 7 days for <strong>⚡ Week Warrior</strong>.
              </p>
            </div>
          </section>

          {/* Achievements */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={14} className="text-amber-500" />
              <h3 className="text-sm font-bold text-gray-900">
                Achievements&nbsp;
                <span className="text-gray-400 font-normal">
                  {profile.achievements.length} / {allAchievements.length}
                </span>
              </h3>
            </div>
            <div className="space-y-2">
              {allAchievements.map((a) => {
                const unlocked = unlockedIds.has(a.id)
                return (
                  <div key={a.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors
                      ${unlocked
                        ? 'bg-gradient-to-br from-gold-400/10 to-gold-500/20 border-gold-400/30'
                        : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <span className={`text-xl ${unlocked ? '' : 'grayscale'}`}>{a.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900">{a.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{a.description}</p>
                    </div>
                    {unlocked
                      ? <span className="badge-green text-[10px] shrink-0">+{a.xpReward} XP</span>
                      : <Lock size={12} className="text-gray-300 shrink-0" />
                    }
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
