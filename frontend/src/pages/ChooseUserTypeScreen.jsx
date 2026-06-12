import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BriefcaseBusiness, GraduationCap, Sparkles, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { useApp } from "../context/AppContext";
import OnboardingStepIndicator from "../components/onboarding/OnboardingStepIndicator";

const OPTIONS = [
  {
    key: "business",
    title: "Business",
    icon: BriefcaseBusiness,
    description: "Build your brand presence, campaigns, and audience growth with structured workflows.",
  },
  {
    key: "influencer",
    title: "Influencer",
    icon: UserRound,
    description: "Scale content reach with creator-first tools, audience targeting, and growth insights.",
  },
  {
    key: "student",
    title: "Student",
    icon: GraduationCap,
    description: "Manage your personal brand, projects, and academic social presence with ease.",
  },
];

export default function ChooseUserTypeScreen() {
  const navigate = useNavigate();
  const { draftSignupSession, updateDraftSignupSession, setToast } = useApp();
  const [selected, setSelected] = useState(draftSignupSession?.selectedUserType || "");
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    updateDraftSignupSession({ selectedUserType: selected });
    setSubmitting(false);
    if (!draftSignupSession?.authDraftToken) {
      setToast({ message: "Signup session expired. Please sign up again.", error: true });
      navigate("/signup", { replace: true });
      return;
    }
    navigate("/onboarding/profile-setup");
  };

  return (
    <div className="min-h-dvh bg-[#e4ebe8] px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <OnboardingStepIndicator activeStep="user-type" />
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="mb-6">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs text-brand-700">
              <Sparkles size={12} />
              Personalize your EngageHub experience
            </div>
            <h1 className="text-2xl font-semibold sm:text-3xl">Choose your user type</h1>
            <p className="mt-2 text-sm text-slate-500">
              This helps us tailor onboarding and setup for your workflows.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = selected === option.key;
              return (
                <motion.button
                  key={option.key}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelected(option.key)}
                  className={[
                    "rounded-2xl border p-5 text-left transition",
                    isSelected
                      ? "border-brand-300 bg-brand-50 shadow-[0_0_0_1px_rgba(74,108,247,0.2)]"
                      : "border-slate-200 bg-white hover:border-brand-300",
                  ].join(" ")}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <Icon size={20} className={isSelected ? "text-brand-600" : "text-slate-500"} />
                    </div>
                    <p className="text-lg font-semibold">{option.title}</p>
                  </div>
                  <p className="text-sm text-slate-600">{option.description}</p>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-7 flex justify-end">
            <button
              type="button"
              disabled={!selected || submitting}
              onClick={handleContinue}
              className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting ? "Saving..." : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
