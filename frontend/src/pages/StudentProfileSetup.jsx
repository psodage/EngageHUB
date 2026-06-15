import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Upload } from "lucide-react";
import { useApp } from "../context/AppContext";
import { uploadSocialPublicMediaFile } from "../services/socialApi";
import ProfileSetupStepper from "../components/onboarding/ProfileSetupStepper";

const INITIAL_FORM = {
  fullName: "",
  schoolName: "",
  major: "",
  gradYear: "",
  bio: "",
  email: "",
  profileImage: "",
  coverImage: "",
  interests: "",
  socialHandles: "",
  portfolioUrl: "",
};

export default function StudentProfileSetup() {
  const navigate = useNavigate();
  const { user, draftSignupSession, completeDraftSignup, setToast } = useApp();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    ...INITIAL_FORM,
    ...(user.studentProfile || {}),
    email: user.email || draftSignupSession?.email || user.studentProfile?.email || "",
  });

  const validateStep1 = () => {
    const next = {};
    if (!String(form.fullName || "").trim()) next.fullName = "Full name is required.";
    if (!String(form.schoolName || "").trim()) next.schoolName = "School or university name is required.";
    if (!String(form.major || "").trim()) next.major = "Major or field of study is required.";
    
    const gradYearStr = String(form.gradYear || "").trim();
    if (!gradYearStr) {
      next.gradYear = "Graduation year is required.";
    } else {
      const year = parseInt(gradYearStr, 10);
      if (isNaN(year) || year < 2000 || year > 2040) {
        next.gradYear = "Please enter a valid graduation year.";
      }
    }

    if (!String(form.bio || "").trim()) next.bio = "Bio is required.";
    
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = () => {
    const next = {};
    
    const portfolio = String(form.portfolioUrl || "").trim();
    if (portfolio && !/^https?:\/\//.test(portfolio)) {
      next.portfolioUrl = "Use a valid URL starting with http:// or https://";
    }

    setErrors((prev) => ({ ...prev, ...next }));
    return Object.keys(next).length === 0;
  };

  const uploadAsset = async (file, key, setUploading) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadSocialPublicMediaFile(file);
      setForm((prev) => ({ ...prev, [key]: url }));
      setErrors((prev) => ({ ...prev, [key]: "" }));
      setToast({ message: "Asset uploaded successfully." });
    } catch (error) {
      setToast({ message: error?.message || "Upload failed.", error: true });
    } finally {
      setUploading(false);
    }
  };

  const handleFinish = async () => {
    if (step !== 2 || saving) return;
    if (!validateStep2()) return;
    setSaving(true);
    try {
      const draftToken = draftSignupSession?.authDraftToken;
      if (!draftToken) throw new Error("Missing signup session.");
      const result = await completeDraftSignup({
        selectedUserType: "student",
        studentProfile: form,
      });
      if (!result.ok) {
        throw result.error || new Error("Unable to save student profile.");
      }
      navigate("/onboarding/link-accounts");
    } catch (error) {
      setToast({ message: error.message || "Failed to complete setup.", error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#e4ebe8] px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <ProfileSetupStepper currentStep={step} />

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="mb-6">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs text-brand-700">
              <Sparkles size={12} />
              Personalize your workspace
            </div>
            <h1 className="text-2xl font-semibold sm:text-3xl">Student Profile Setup</h1>
            <p className="mt-2 text-sm text-slate-500">
              {step === 1 ? "Tell us about your studies." : "Add some visual details and social profiles."}
            </p>
          </div>

          {step === 1 ? (
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.fullName ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="Alex Morgan"
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="schoolName" className="mb-1.5 block text-sm font-medium">
                    School / University
                  </label>
                  <input
                    id="schoolName"
                    type="text"
                    value={form.schoolName}
                    onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.schoolName ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="Stanford University"
                  />
                  {errors.schoolName && (
                    <p className="mt-1 text-xs text-red-500">{errors.schoolName}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="major" className="mb-1.5 block text-sm font-medium">
                    Major / Field of Study
                  </label>
                  <input
                    id="major"
                    type="text"
                    value={form.major}
                    onChange={(e) => setForm({ ...form, major: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.major ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="Computer Science"
                  />
                  {errors.major && (
                    <p className="mt-1 text-xs text-red-500">{errors.major}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="gradYear" className="mb-1.5 block text-sm font-medium">
                    Graduation Year
                  </label>
                  <input
                    id="gradYear"
                    type="text"
                    value={form.gradYear}
                    onChange={(e) => setForm({ ...form, gradYear: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.gradYear ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="2027"
                  />
                  {errors.gradYear && (
                    <p className="mt-1 text-xs text-red-500">{errors.gradYear}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="bio" className="mb-1.5 block text-sm font-medium">
                  Bio / About Me
                </label>
                <textarea
                  id="bio"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                  className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                    errors.bio ? "border-red-500" : "border-slate-200"
                  }`}
                  placeholder="Tell us what you're passionate about..."
                />
                {errors.bio && (
                  <p className="mt-1 text-xs text-red-500">{errors.bio}</p>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => validateStep1() && setStep(2)}
                  className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-3 block text-sm font-medium">Profile Picture (Optional)</label>
                  <div className="flex items-center gap-5">
                    <div className="h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      {form.profileImage ? (
                        <img src={form.profileImage} alt="Profile picture" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <div className="text-4xl">👤</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-50">
                        <Upload size={16} />
                        {uploadingProfile ? "Uploading..." : "Upload Photo"}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => uploadAsset(e.target.files?.[0], "profileImage", setUploadingProfile)}
                        />
                      </label>
                      <p className="mt-2 text-xs text-slate-500">Recommended: Square image, max 2MB.</p>
                    </div>
                  </div>
                  {errors.profileImage && <p className="mt-1 text-xs text-red-500">{errors.profileImage}</p>}
                </div>
                <div>
                  <label className="mb-3 block text-sm font-medium">Cover Image (Optional)</label>
                  <div className="flex items-center gap-5">
                    <div className="h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      {form.coverImage ? (
                        <img
                          src={form.coverImage}
                          alt="Cover banner"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <div className="text-4xl">🖼️</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-50">
                        <Upload size={16} />
                        {uploadingCover ? "Uploading..." : "Upload Cover"}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => uploadAsset(e.target.files?.[0], "coverImage", setUploadingCover)}
                        />
                      </label>
                      <p className="mt-2 text-xs text-slate-500">Recommended: 16:9 ratio, max 5MB.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="interests" className="mb-1.5 block text-sm font-medium">
                    Interests / Focus Areas (Optional)
                  </label>
                  <input
                    id="interests"
                    type="text"
                    value={form.interests}
                    onChange={(e) => setForm({ ...form, interests: e.target.value })}
                    className="w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 border-slate-200"
                    placeholder="Coding, Design, Marketing"
                  />
                </div>
                <div>
                  <label htmlFor="portfolioUrl" className="mb-1.5 block text-sm font-medium">
                    Portfolio / Website URL (Optional)
                  </label>
                  <input
                    id="portfolioUrl"
                    type="url"
                    value={form.portfolioUrl}
                    onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.portfolioUrl ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="https://alexmorgan.dev"
                  />
                  {errors.portfolioUrl && (
                    <p className="mt-1 text-xs text-red-500">{errors.portfolioUrl}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="rounded-xl bg-brand-600 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
                >
                  {saving ? "Finishing..." : "Complete Setup"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
