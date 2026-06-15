import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Upload } from "lucide-react";
import { useApp } from "../context/AppContext";
import { uploadSocialPublicMediaFile } from "../services/socialApi";
import ProfileSetupStepper from "../components/onboarding/ProfileSetupStepper";

const INITIAL_FORM = {
  fullName: "",
  creatorUsername: "",
  niche: "",
  bio: "",
  email: "",
  location: "",
  profileImage: "",
  coverImage: "",
  primaryPlatforms: "",
  followerCount: "",
  contentCategories: "",
  socialHandles: "",
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InfluencerProfileSetup() {
  const navigate = useNavigate();
  const { user, draftSignupSession, completeDraftSignup, setToast } = useApp();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ ...INITIAL_FORM, ...(user.influencerProfile || {}) });

  const validateStep1 = () => {
    const next = {};
    if (!String(form.fullName || "").trim()) next.fullName = "Full name is required.";
    if (!String(form.creatorUsername || "").trim()) next.creatorUsername = "Creator username is required.";
    if (!String(form.niche || "").trim()) next.niche = "Niche is required.";
    if (!String(form.bio || "").trim()) next.bio = "Bio is required.";
    if (!EMAIL_REGEX.test(String(form.email || "").trim())) next.email = "Use a valid email.";
    if (!String(form.location || "").trim()) next.location = "Location is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = () => {
    const next = {};
    if (!String(form.coverImage || "").trim()) next.coverImage = "Cover image is required.";
    if (!String(form.primaryPlatforms || "").trim()) next.primaryPlatforms = "Primary platforms are required.";
    if (!String(form.followerCount || "").trim()) next.followerCount = "Follower count is required.";
    if (!String(form.contentCategories || "").trim()) next.contentCategories = "Content categories are required.";
    if (!String(form.socialHandles || "").trim()) next.socialHandles = "Social handles are required.";
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
        selectedUserType: "influencer",
        influencerProfile: form,
      });
      if (!result.ok) {
        throw result.error || new Error("Unable to save influencer profile.");
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
            <h1 className="text-2xl font-semibold sm:text-3xl">Influencer Profile Setup</h1>
            <p className="mt-2 text-sm text-slate-500">
              {step === 1 ? "Tell us about yourself as a creator." : "Add visual assets to complete your profile."}
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
                  {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
                </div>
                <div>
                  <label htmlFor="creatorUsername" className="mb-1.5 block text-sm font-medium">
                    Creator Username
                  </label>
                  <input
                    id="creatorUsername"
                    type="text"
                    value={form.creatorUsername}
                    onChange={(e) => setForm({ ...form, creatorUsername: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.creatorUsername ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="@alexmorgan"
                  />
                  {errors.creatorUsername && (
                    <p className="mt-1 text-xs text-red-500">{errors.creatorUsername}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="niche" className="mb-1.5 block text-sm font-medium">
                    Niche
                  </label>
                  <input
                    id="niche"
                    type="text"
                    value={form.niche}
                    onChange={(e) => setForm({ ...form, niche: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.niche ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="Fitness & Wellness"
                  />
                  {errors.niche && <p className="mt-1 text-xs text-red-500">{errors.niche}</p>}
                </div>
                <div>
                  <label htmlFor="location" className="mb-1.5 block text-sm font-medium">
                    Location
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.location ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="New York, NY"
                  />
                  {errors.location && <p className="mt-1 text-xs text-red-500">{errors.location}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="bio" className="mb-1.5 block text-sm font-medium">
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                  className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                    errors.bio ? "border-red-500" : "border-slate-200"
                  }`}
                  placeholder="Tell your audience who you are and what you create..."
                />
                {errors.bio && <p className="mt-1 text-xs text-red-500">{errors.bio}</p>}
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                  Creator Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                    errors.email ? "border-red-500" : "border-slate-200"
                  }`}
                  placeholder="alex@example.com"
                />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
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
                        <img src={form.profileImage} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <div className="text-4xl">👤</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-50">
                        <Upload size={16} />
                        {uploadingProfile ? "Uploading..." : "Upload Profile"}
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
                  <label className="mb-3 block text-sm font-medium">Cover Image</label>
                  <div className="flex items-center gap-5">
                    <div className="h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      {form.coverImage ? (
                        <img src={form.coverImage} alt="Cover" className="h-full w-full object-cover" />
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
                  {errors.coverImage && <p className="mt-1 text-xs text-red-500">{errors.coverImage}</p>}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="primaryPlatforms" className="mb-1.5 block text-sm font-medium">
                    Primary Platforms
                  </label>
                  <input
                    id="primaryPlatforms"
                    type="text"
                    value={form.primaryPlatforms}
                    onChange={(e) => setForm({ ...form, primaryPlatforms: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.primaryPlatforms ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="Instagram, TikTok, YouTube"
                  />
                  {errors.primaryPlatforms && (
                    <p className="mt-1 text-xs text-red-500">{errors.primaryPlatforms}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="followerCount" className="mb-1.5 block text-sm font-medium">
                    Total Followers
                  </label>
                  <input
                    id="followerCount"
                    type="text"
                    value={form.followerCount}
                    onChange={(e) => setForm({ ...form, followerCount: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.followerCount ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="125K"
                  />
                  {errors.followerCount && (
                    <p className="mt-1 text-xs text-red-500">{errors.followerCount}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="contentCategories" className="mb-1.5 block text-sm font-medium">
                    Content Categories
                  </label>
                  <input
                    id="contentCategories"
                    type="text"
                    value={form.contentCategories}
                    onChange={(e) => setForm({ ...form, contentCategories: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.contentCategories ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="Workouts, Meal Prep, Motivation"
                  />
                  {errors.contentCategories && (
                    <p className="mt-1 text-xs text-red-500">{errors.contentCategories}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="socialHandles" className="mb-1.5 block text-sm font-medium">
                    Social Handles
                  </label>
                  <input
                    id="socialHandles"
                    type="text"
                    value={form.socialHandles}
                    onChange={(e) => setForm({ ...form, socialHandles: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.socialHandles ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="@alexmorgan (Instagram, TikTok, YouTube)"
                  />
                  {errors.socialHandles && (
                    <p className="mt-1 text-xs text-red-500">{errors.socialHandles}</p>
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
