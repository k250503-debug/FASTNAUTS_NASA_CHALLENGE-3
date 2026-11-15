import React, { useState } from 'react';
import { CheckCircle2, Palette, Shield, Sparkles, UserCheck, X } from 'lucide-react';
import { motion } from 'motion/react';
import { ASTRONAUTS, getAstronautById } from '../data/astronauts';
import AstronautPreview3D, { type AstronautStudioFocus } from '../three/AstronautPreview3D';
import { playSpaceSfx } from '../utils/spaceAudio';
import type {
  AstronautCustomization,
  AstronautId,
  BackpackStyleId,
  HelmetStyleId,
  SuitDesignId,
} from '../types';

const SUIT_DESIGNS: Array<{ id: SuitDesignId; label: string; spec: string }> = [
  { id: 'artemis_eva', label: 'Artemis EVA', spec: 'Balanced thermal & dust mobility' },
  { id: 'tactical_recon', label: 'Tactical Recon', spec: 'Reinforced harness & agility' },
  { id: 'cryo_heavy', label: 'Cryo Heavy', spec: 'Insulated shroud for Europa/Titan' },
];

const HELMET_STYLES: Array<{ id: HelmetStyleId; label: string }> = [
  { id: 'gold_reflective', label: 'Gold Reflective' },
  { id: 'tinted_obsidian', label: 'Obsidian Tint' },
  { id: 'clear_hud', label: 'Clear HUD' },
];

const BACKPACK_STYLES: Array<{ id: BackpackStyleId; label: string }> = [
  { id: 'plss_standard', label: 'PLSS Standard' },
  { id: 'dual_thruster', label: 'SAFER Thrusters' },
  { id: 'science_pack', label: 'Science Array' },
];

const PRIMARY_COLORS: Array<{ label: string; hex: number; css: string }> = [
  { label: 'Lunar White', hex: 0xf1f5f9, css: '#F1F5F9' },
  { label: 'Titanium Gray', hex: 0x94a3b8, css: '#94A3B8' },
  { label: 'Carbon Slate', hex: 0x334155, css: '#334155' },
  { label: 'Regolith Tan', hex: 0xd6b48a, css: '#D6B48A' },
];

const ACCENT_COLORS: Array<{ label: string; hex: number; css: string }> = [
  { label: 'NASA Cyan', hex: 0x38bdf8, css: '#38BDF8' },
  { label: 'Solar Amber', hex: 0xf59e0b, css: '#F59E0B' },
  { label: 'Bio Emerald', hex: 0x10b981, css: '#10B981' },
  { label: 'Hazard Crimson', hex: 0xf43f5e, css: '#F43F5E' },
  { label: 'Cryo Violet', hex: 0xa855f7, css: '#A855F7' },
  { label: 'Cobalt Blue', hex: 0x2563eb, css: '#2563EB' },
];

interface AstronautGalleryModalProps {
  activeAstronautId: AstronautId;
  customizations: Record<AstronautId, AstronautCustomization>;
  onUpdateCustomization: (id: AstronautId, next: AstronautCustomization) => void;
  onSelectAstronaut: (id: AstronautId) => void;
  onClose: () => void;
  isMuted?: boolean;
}

export default function AstronautGalleryModal({
  activeAstronautId,
  customizations,
  onUpdateCustomization,
  onSelectAstronaut,
  onClose,
  isMuted = false,
}: AstronautGalleryModalProps) {
  const [inspectId, setInspectId] = useState<AstronautId>(activeAstronautId);
  const [focus, setFocus] = useState<AstronautStudioFocus>('full');

  const profile = getAstronautById(inspectId);
  const custom = customizations[inspectId];

  const patchCustom = (partial: Partial<AstronautCustomization>) => {
    playSpaceSfx('ui_click', isMuted);
    onUpdateCustomization(inspectId, { ...custom, ...partial });
  };

  return (
    <div className="fixed inset-0 z-50 astra-glass-backdrop flex items-center justify-center p-3 sm:p-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-6xl h-[min(90vh,760px)] rounded-2xl astra-glass-modal overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/15 flex items-center justify-between gap-4 bg-slate-950/35">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-300">
              3D Crew Selection &amp; Suit Engineering Studio
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-white">
              Astronaut Gallery &amp; Live Customization
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close astronaut gallery"
            className="p-2 rounded-lg astra-glass-subtle hover:border-cyan-400 text-slate-200 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
          {/* Left: Character Selection Cards */}
          <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-white/15 p-3 overflow-y-auto bg-slate-950/25 flex lg:flex-col gap-2">
            {ASTRONAUTS.map((astro) => {
              const selected = inspectId === astro.id;
              const isActive = activeAstronautId === astro.id;
              return (
                <button
                  key={astro.id}
                  type="button"
                  onClick={() => {
                    playSpaceSfx('ui_click', isMuted);
                    setInspectId(astro.id);
                  }}
                  className={`min-w-[190px] lg:min-w-0 w-full p-3 rounded-xl border text-left transition-colors shrink-0 ${
                    selected
                      ? 'bg-cyan-500/20 border-cyan-400 text-white'
                      : 'astra-glass-subtle text-slate-200 hover:border-cyan-400/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: astro.suitColor }}
                      />
                      <span className="font-display font-bold text-sm truncate">{astro.name}</span>
                    </div>
                    {isActive && (
                      <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-cyan-300 truncate">{astro.role}</div>
                  <div className="text-[10px] font-mono text-slate-300 truncate mt-0.5">
                    {astro.assignedWorldName}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Center: Interactive 360-deg 3D Astronaut Model */}
          <div className="lg:col-span-5 relative min-h-[280px] bg-slate-950/35 border-b lg:border-b-0 lg:border-r border-white/15">
            <AstronautPreview3D
              astronautId={inspectId}
              customization={custom}
              focus={focus}
            />

            <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-1 astra-glass-pill border border-white/15 rounded-lg p-1">
                {(
                  [
                    { id: 'full', label: 'Full Suit' },
                    { id: 'helmet', label: 'Helmet' },
                    { id: 'backpack', label: 'Backpack' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      playSpaceSfx('ui_click', isMuted);
                      setFocus(f.id);
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
                      focus === f.id
                        ? 'bg-cyan-400 text-slate-950 font-bold'
                        : 'text-slate-200 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-3 inset-x-3 flex items-center justify-between text-[11px] font-mono text-slate-300 astra-glass-pill border border-white/15 rounded-lg px-3 py-1.5">
              <span>Drag: 360° Rotate · Scroll/Pinch: Zoom</span>
              <span className="text-cyan-300 truncate ml-2">{profile.name}</span>
            </div>
          </div>

          {/* Right: Specs & Real-Time 3D Customization */}
          <div className="lg:col-span-4 p-4 sm:p-5 overflow-y-auto flex flex-col justify-between gap-4 bg-slate-950/20">
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-mono text-cyan-300">{profile.role}</div>
                <h3 className="font-display text-2xl font-bold text-white">{profile.name}</h3>
                <p className="text-xs text-slate-200 leading-relaxed mt-1.5">
                  {profile.taskDescription}
                </p>
                <div className="mt-2 px-3 py-2 rounded-lg astra-glass-subtle text-[11px] text-emerald-300">
                  Specialty: {profile.specialtyBonus}
                </div>
              </div>

              {/* Suit Design Selector */}
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  Suit Architecture
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {SUIT_DESIGNS.map((sd) => (
                    <button
                      key={sd.id}
                      type="button"
                      onClick={() => patchCustom({ suitDesign: sd.id })}
                      className={`p-2 rounded-lg border text-left transition-colors ${
                        custom.suitDesign === sd.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'astra-glass-subtle text-slate-200 hover:border-cyan-400/50'
                      }`}
                    >
                      <div className="text-[11px] font-semibold">{sd.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Helmet Customization */}
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Helmet Visor Assembly
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {HELMET_STYLES.map((hs) => (
                    <button
                      key={hs.id}
                      type="button"
                      onClick={() => {
                        setFocus('helmet');
                        patchCustom({ helmetStyle: hs.id });
                      }}
                      className={`p-2 rounded-lg border text-center text-[11px] font-medium transition-colors ${
                        custom.helmetStyle === hs.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'astra-glass-subtle text-slate-200 hover:border-cyan-400/50'
                      }`}
                    >
                      {hs.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Backpack & Equipment Pack */}
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                  PLSS Backpack &amp; Rig
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {BACKPACK_STYLES.map((bp) => (
                    <button
                      key={bp.id}
                      type="button"
                      onClick={() => {
                        setFocus('backpack');
                        patchCustom({ backpackStyle: bp.id });
                      }}
                      className={`p-2 rounded-lg border text-center text-[11px] font-medium transition-colors ${
                        custom.backpackStyle === bp.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'astra-glass-subtle text-slate-200 hover:border-cyan-400/50'
                      }`}
                    >
                      {bp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1">
                    <Palette className="w-3 h-3 text-cyan-400" /> Suit Finish
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRIMARY_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        title={c.label}
                        onClick={() => patchCustom({ primaryColorHex: c.hex })}
                        className={`w-7 h-7 rounded-lg border-2 transition-transform ${
                          custom.primaryColorHex === c.hex
                            ? 'border-cyan-400 scale-110'
                            : 'border-white/25 hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.css }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                    Trim Accent
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ACCENT_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        title={c.label}
                        onClick={() => patchCustom({ accentColorHex: c.hex })}
                        className={`w-7 h-7 rounded-lg border-2 transition-transform ${
                          custom.accentColorHex === c.hex
                            ? 'border-white scale-110'
                            : 'border-white/25 hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.css }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/15">
              <button
                type="button"
                onClick={() => {
                  playSpaceSfx('ui_select', isMuted);
                  onSelectAstronaut(inspectId);
                  onClose();
                }}
                className="w-full py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {activeAstronautId === inspectId ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Selected ({profile.name}) — Return
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Select {profile.name} as Active Crew
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
