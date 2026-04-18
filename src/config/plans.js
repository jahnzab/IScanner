export const PLANS = [
  {
    id: "free",
    name: "Free",
    amount: 0,
    description: "Free use with watermark on downloaded image or PDF",
    features: ["Watermark added", "Basic scan only"]
  },
  {
    id: "day",
    name: "3 Day Pass",
    amount: 10,
    originalAmount: 20,
    description: "Text and signature editing without watermark for three days",
    features: ["Text tools", "Signature tools", "No watermark", "Combine files"]
  },
  {
    id: "fiveDay",
    name: "7 Day Pass",
    amount: 20,
    originalAmount: 40,
    description: "Editing tools and clean export for seven days",
    features: ["Text tools", "Signature tools", "No watermark", "Combine files"]
  },
  {
    id: "weekly",
    name: "1 Month Pass",
    amount: 79,
    originalAmount: 158,
    description: "Full editing toolkit for one month",
    features: ["Text tools", "Signature tools", "No watermark", "Combine files"]
  },
  {
    id: "monthly",
    name: "3 Month Pass",
    amount: 199,
    originalAmount: 398,
    description: "Best for regular document editing work for three months",
    features: ["Text tools", "Signature tools", "No watermark", "Combine files"]
  }
];

export function findPlan(planId) {
  return PLANS.find((plan) => plan.id === planId);
}
