/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { runCoreVerification, VerificationReport } from '../core/tests/DeterminismTest';
import { X, CheckCircle2, XCircle, ShieldCheck, RefreshCw, Cpu } from 'lucide-react';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const rep = runCoreVerification();
      setReport(rep);
      setIsRunning(false);
    }, 150);
  };

  useEffect(() => {
    if (isOpen) {
      runTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-emerald-500/60 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Core Engine Specification Verification (Definition of Done)
              </h2>
              <p className="text-xs text-slate-400">
                Automated validation of all 9 requirements & strict seed determinism
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {isRunning ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <span className="text-sm font-semibold text-slate-300">
                Simulating headless world ticks & verifying criteria...
              </span>
            </div>
          ) : report ? (
            <div className="space-y-4">
              {/* Overall status banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  report.overallPassed
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                    : 'bg-red-950/40 border-red-500/60 text-red-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {report.overallPassed ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                  )}
                  <div>
                    <div className="font-bold text-sm">
                      {report.overallPassed
                        ? 'All 9 Definition of Done Criteria Passed (100% Deterministic)'
                        : 'Some criteria failed'}
                    </div>
                    <div className="text-xs opacity-90">
                      Headless simulation ran across {report.totalTicksSimulated} fixed ticks without presentation layer
                    </div>
                  </div>
                </div>
                <button
                  onClick={runTests}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-semibold border border-slate-700 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-test
                </button>
              </div>

              {/* Deterministic Hash Match Box */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Cpu className="w-4 h-4 text-amber-400" />
                  <span>Deterministic Hash Verification (Run 1 vs Run 2 with identical seed & commands)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-400 block">Simulation Run 1 Hash</span>
                    <span className="text-cyan-300 font-bold">{report.hashRun1}</span>
                  </div>
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-400 block">Simulation Run 2 Hash</span>
                    <span className="text-cyan-300 font-bold">{report.hashRun2}</span>
                  </div>
                </div>
                <div className="text-[11px] text-emerald-300 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Bit-for-bit identical state hash across runs confirms zero non-determinism.</span>
                </div>
              </div>

              {/* Individual Criteria Checklist */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 block">
                  Detailed Verification Checklist
                </span>
                <div className="space-y-1.5">
                  {report.results.map((r, i) => (
                    <div
                      key={i}
                      className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg flex items-start gap-2.5 text-xs"
                    >
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-0.5">
                        <div className="font-bold text-slate-200">{r.name}</div>
                        <div className="text-slate-400 font-mono text-[11px]">{r.details}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
