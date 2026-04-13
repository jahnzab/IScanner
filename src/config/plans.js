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
    name: "1 Day Pass",
    amount: 15,
    description: "Text and signature editing without watermark for one day",
    features: ["Text tools", "Signature tools", "No watermark", "Combine files"]
  },
  {
    id: "fiveDay",
    name: "5 Day Pass",
    amount: 40,
    description: "Editing tools and clean export for five days",
    features: ["Text tools", "Signature tools", "No watermark", "Combine files"]
  },
  {
    id: "weekly",
    name: "Weekly Pass",
    amount: 79,
    description: "Full editing toolkit for seven days",
    features: ["Text tools", "Signature tools", "No watermark", "Combine files"]
  },
  {
    id: "monthly",
    name: "Monthly Pass",
    amount: 199,
    description: "Best for regular document editing work",
    features: ["Text tools", "Signature tools", "No watermark", "Combine files"]
  }
];

export function findPlan(planId) {
  return PLANS.find((plan) => plan.id === planId);
}
