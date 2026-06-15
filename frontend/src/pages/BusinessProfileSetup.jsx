import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Upload } from "lucide-react";
import { useApp } from "../context/AppContext";
import { uploadSocialPublicMediaFile } from "../services/socialApi";
import ProfileSetupStepper from "../components/onboarding/ProfileSetupStepper";

const INITIAL_FORM = {
  businessName: "",
  industry: "",
  websiteUrl: "",
  businessEmail: "",
  description: "",
  logo: "",
  bannerImage: "",
  brandColors: "",
  companyLocation: "",
  contactNumber: "",
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BusinessProfileSetup() {
  const navigate = useNavigate();
  const { user, draftSignupSession, completeDraftSignup, setToast } = useApp();
  const registeredEmail = draftSignupSession?.email || user?.email || "";

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    businessEmail: registeredEmail,
    ...(user.businessProfile || {}),
  }));

  const validateStep1 = () => {
    const next = {};
    if (!String(form.businessName || "").trim()) next.businessName = "Business name is required.";
    if (!String(form.industry || "").trim()) next.industry = "Industry is required.";
    if (!String(form.description || "").trim()) next.description = "Business description is required.";
    if (!/^https?:\/\//.test(String(form.websiteUrl || "").trim())) next.websiteUrl = "Use a valid URL starting with http:// or https://";
    
    const emailToValidate = form.businessEmail || registeredEmail;
    if (!EMAIL_REGEX.test(String(emailToValidate || "").trim())) {
      next.businessEmail = "Use a valid business email.";
    }

    if (!String(form.contactNumber || "").trim()) next.contactNumber = "Contact number is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = () => {
    return true;
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
        selectedUserType: "business",
        businessProfile: {
          ...form,
          businessEmail: registeredEmail,
        },
      });
      if (!result.ok) {
        throw result.error || new Error("Unable to save business profile.");
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
            <h1 className="text-2xl font-semibold sm:text-3xl">Business Profile Setup</h1>
            <p className="mt-2 text-sm text-slate-500">
              {step === 1 ? "Tell us about your business." : "Add some visual details to your profile."}
            </p>
          </div>

          {step === 1 ? (
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="businessName" className="mb-1.5 block text-sm font-medium">
                    Business Name
                  </label>
                  <input
                    id="businessName"
                    type="text"
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.businessName ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="Acme Corp"
                  />
                  {errors.businessName && (
                    <p className="mt-1 text-xs text-red-500">{errors.businessName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="industry" className="mb-1.5 block text-sm font-medium">
                    Industry
                  </label>
                  <input
                    id="industry"
                    type="text"
                    value={form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.industry ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="Technology"
                  />
                  {errors.industry && (
                    <p className="mt-1 text-xs text-red-500">{errors.industry}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="businessEmail" className="mb-1.5 block text-sm font-medium">
                    Business Email
                  </label>
                  <input
                    id="businessEmail"
                    type="email"
                    value={form.businessEmail}
                    disabled
                    className="w-full rounded-xl border bg-slate-50 px-4 py-2.5 transition text-slate-500 border-slate-200 cursor-not-allowed"
                    placeholder="hello@acme.com"
                  />
                  <p className="mt-1 text-xs text-slate-400 font-normal">
                    This is your registered account email address.
                  </p>
                </div>
                <div>
                  <label htmlFor="contactNumber" className="mb-1.5 block text-sm font-medium">
                    Contact Number
                  </label>
                  <input
                    id="contactNumber"
                    type="text"
                    value={form.contactNumber}
                    onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                      errors.contactNumber ? "border-red-500" : "border-slate-200"
                    }`}
                    placeholder="+1 555 123 4567"
                  />
                  {errors.contactNumber && (
                    <p className="mt-1 text-xs text-red-500">{errors.contactNumber}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="websiteUrl" className="mb-1.5 block text-sm font-medium">
                  Website URL
                </label>
                <input
                  id="websiteUrl"
                  type="url"
                  value={form.websiteUrl}
                  onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                  className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                    errors.websiteUrl ? "border-red-500" : "border-slate-200"
                  }`}
                  placeholder="https://acme.com"
                />
                {errors.websiteUrl && (
                  <p className="mt-1 text-xs text-red-500">{errors.websiteUrl}</p>
                )}
              </div>

              <div>
                <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
                  Business Description
                </label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className={`w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 ${
                    errors.description ? "border-red-500" : "border-slate-200"
                  }`}
                  placeholder="Tell us what your business does..."
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-red-500">{errors.description}</p>
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
                  <label className="mb-3 block text-sm font-medium">Business Logo (Optional)</label>
                  <div className="flex items-center gap-5">
                    <div className="h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      {form.logo ? (
                        <img src={form.logo} alt="Business logo" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <div className="text-4xl">🏢</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-50">
                        <Upload size={16} />
                        {uploadingLogo ? "Uploading..." : "Upload Logo"}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => uploadAsset(e.target.files?.[0], "logo", setUploadingLogo)}
                        />
                      </label>
                      <p className="mt-2 text-xs text-slate-500">Recommended: Square image, max 2MB.</p>
                    </div>
                  </div>
                  {errors.logo && <p className="mt-1 text-xs text-red-500">{errors.logo}</p>}
                </div>
                <div>
                  <label className="mb-3 block text-sm font-medium">Banner Image (Optional)</label>
                  <div className="flex items-center gap-5">
                    <div className="h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      {form.bannerImage ? (
                        <img
                          src={form.bannerImage}
                          alt="Business banner"
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
                        {uploadingBanner ? "Uploading..." : "Upload Banner"}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => uploadAsset(e.target.files?.[0], "bannerImage", setUploadingBanner)}
                        />
                      </label>
                      <p className="mt-2 text-xs text-slate-500">Recommended: 16:9 ratio, max 5MB.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="brandColors" className="mb-1.5 block text-sm font-medium">
                    Brand Colors (Optional) (e.g., #6D5EF8, #FFFFFF)
                  </label>
                  <input
                    id="brandColors"
                    type="text"
                    value={form.brandColors}
                    onChange={(e) => setForm({ ...form, brandColors: e.target.value })}
                    className="w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 border-slate-200"
                    placeholder="#6D5EF8, #FFFFFF"
                  />
                </div>
                <div>
                  <label htmlFor="companyLocation" className="mb-1.5 block text-sm font-medium">
                    Company Location (Optional)
                  </label>
                  <input
                    id="companyLocation"
                    type="text"
                    value={form.companyLocation}
                    onChange={(e) => setForm({ ...form, companyLocation: e.target.value })}
                    className="w-full rounded-xl border bg-white px-4 py-2.5 transition focus:ring-2 focus:ring-brand-500/20 border-slate-200"
                    placeholder="San Francisco, CA"
                  />
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
