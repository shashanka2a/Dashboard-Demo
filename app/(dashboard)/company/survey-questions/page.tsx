"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { inferPositiveAnswer, type PositiveAnswer } from "@/lib/survey-default-questions";

type Draft = {
  key: string;
  question: string;
  requires_text_description: boolean;
  positive_answer: PositiveAnswer;
};

export default function CompanySurveyQuestionsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/company/survey-questions", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load");
      const qs = Array.isArray(data.questions) ? data.questions : [];
      setDrafts(
        qs.map((q: {
          id?: string;
          question?: string;
          requires_text_description?: boolean;
          positive_answer?: PositiveAnswer;
        }) => ({
          key: q.id || `draft-${crypto.randomUUID()}`,
          question: q.question || "",
          requires_text_description: !!q.requires_text_description,
          positive_answer: q.positive_answer === "No" ? "No" : "Yes",
        }))
      );
    } catch (e) {
      setDrafts([]);
      toast.error(e instanceof Error ? e.message : "Failed to load survey questions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const moveQuestion = (index: number, dir: -1 | 1) => {
    setDrafts((prev) => {
      const next = index + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  };

  const save = async (applyToAllProjects: boolean) => {
    if (applyToAllProjects) {
      const ok = confirm(
        "Apply these defaults to every project? This replaces each project's current site survey question list."
      );
      if (!ok) return;
    }

    setSaving(true);
    setSuccess(false);
    const questions = drafts
      .map((d, i) => ({
        question: d.question.trim(),
        sort_order: i,
        requires_text_description: d.requires_text_description,
        positive_answer: d.positive_answer,
      }))
      .filter((q) => q.question.length > 0);

    try {
      const res = await fetch("/api/company/survey-questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions, applyToAllProjects }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");

      const qs = Array.isArray(data.questions) ? data.questions : [];
      setDrafts(
        qs.map((q: {
          id: string;
          question: string;
          requires_text_description: boolean;
          positive_answer?: PositiveAnswer;
        }) => ({
          key: q.id,
          question: q.question,
          requires_text_description: !!q.requires_text_description,
          positive_answer: q.positive_answer === "No" ? "No" : "Yes",
        }))
      );

      if (applyToAllProjects && typeof data.projectsUpdated === "number") {
        toast.success(`Defaults saved and applied to ${data.projectsUpdated} project(s).`);
      } else {
        toast.success("Default survey questions saved.");
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Site survey questions</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Default prompts shown in the field app for every site survey (Yes / No / N/A, with optional notes).
          Green answer is optional — it auto-fills from the question text (problem questions → No, confirmations → Yes).
          New projects copy this list automatically. Use{" "}
          <span className="font-medium text-gray-700">Apply to all projects</span> to push updates to existing
          projects, or customize per project in{" "}
          <Link href="/projects" className="text-[#FF6633] hover:underline">
            project settings
          </Link>
          .
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#FF6633]" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Default questions</h2>
              <p className="text-xs text-gray-500">Order is top-to-bottom in the mobile survey form.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {success && (
              <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void save(false)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save defaults
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void save(true)}
              className="flex items-center gap-2 px-4 py-2 border border-[#FF6633] text-[#FF6633] rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors disabled:opacity-60"
            >
              Apply to all projects
            </button>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" />
            </div>
          ) : (
            <>
              {drafts.length === 0 && (
                <p className="text-sm text-gray-500">
                  No questions yet. Add at least one for field staff to complete a site survey.
                </p>
              )}
              <div className="space-y-3">
                {drafts.map((row, index) => (
                  <div
                    key={row.key}
                    className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 border border-gray-100 rounded-lg bg-gray-50/50"
                  >
                    <div className="flex items-center gap-1 sm:flex-col sm:pt-1 flex-shrink-0">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={index === 0 || saving}
                        onClick={() => moveQuestion(index, -1)}
                        className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={index === drafts.length - 1 || saving}
                        onClick={() => moveQuestion(index, 1)}
                        className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Question
                      </label>
                      <input
                        type="text"
                        value={row.question}
                        disabled={saving}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDrafts((prev) =>
                            prev.map((r, i) =>
                              i === index
                                ? { ...r, question: v, positive_answer: inferPositiveAnswer(v) }
                                : r
                            )
                          );
                        }}
                        placeholder="e.g. Were there any safety concerns or hazards observed?"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633]"
                      />
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={row.requires_text_description}
                          disabled={saving}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setDrafts((prev) =>
                              prev.map((r, i) => (i === index ? { ...r, requires_text_description: checked } : r))
                            );
                          }}
                          className="rounded border-gray-300 text-[#FF6633] focus:ring-[#FF6633]"
                        />
                        <span className="text-sm text-gray-700">
                          Require text description (in addition to Yes / No / N/A)
                        </span>
                      </label>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                          Green answer <span className="font-normal normal-case text-gray-400">(optional)</span>
                        </label>
                        <select
                          value={row.positive_answer}
                          disabled={saving}
                          onChange={(e) => {
                            const positive_answer = e.target.value === "No" ? "No" : "Yes";
                            setDrafts((prev) =>
                              prev.map((r, i) => (i === index ? { ...r, positive_answer } : r))
                            );
                          }}
                          className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633]"
                        >
                          <option value="Yes">Yes is green</option>
                          <option value="No">No is green</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setDrafts((prev) => prev.filter((_, i) => i !== index))}
                      className="self-start p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label="Remove question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setDrafts((prev) => [
                    ...prev,
                    {
                      key: `draft-${crypto.randomUUID()}`,
                      question: "",
                      requires_text_description: false,
                      positive_answer: inferPositiveAnswer(""),
                    },
                  ])
                }
                className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-[#FF6633] hover:text-[#FF6633] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add question
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
