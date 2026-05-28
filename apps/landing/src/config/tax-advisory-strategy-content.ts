export const strategyCatalogColumns = [
  [
    "1031 Exchange",
    "199A Optimization",
    "457 Mark to Market Election for Traders",
    "529 Plan",
    "83(b) Stock Election",
    "Adoption Assistance Tax Benefits",
    "American Opportunity Credit",
    "Athletic Facilities",
    "Backdoor Roth IRA Conversion",
    "Bonus Depreciation",
    "C Corporation entity optimization",
    "Change of Accounting Methods",
    "Child IRA",
    "Conservation Easements (Individual)",
  ],
  [
    "Cost Basis Step-Up",
    "Coverdell ESA",
    "Cryptocurrency Loss Harvesting",
    "De Minimis (Minimal) Benefits",
    "Dependent Care Credit",
    "Distilled spirits",
    "Donor Advised Fund (DAF)",
    "Donor-Advised Fund",
    "Ecomm Software Technology Leverage",
    "Employee Achievement Award",
    "Employee Discounts",
    "Employee Stock Options",
    "Employer-Provided Cell Phones",
    "Family Office Management Company",
  ],
  [
    "FICA Tip Credit",
    "Fringe Benefits",
    "Health Savings Account (Business)",
    "Healthcare RTU",
    "Historic Rehabilitation Tax Credits",
    "Home Administrative Office",
    "IC-DISC",
    "Installment Sale",
    "Inventory Accounting Method Optimization",
    "IRC 179 Deductions",
    "Itemized Deductions",
    "Leveraged Asset Donation",
    "Leveraged Technology Purchase",
    "Lifetime Learning Credit",
  ],
  [
    "Limited Partnership/General Partnership Structure",
    "Lodging on Your Business Premises",
    "Long-Term Rentals (LTR)",
    "Low-Income Housing Tax Credits (LIHTC)",
    "Management Buyout (MBO) structuring",
    "Medical Technology Tax Credit",
    "Net Investment Income Tax (NIIT) Minimization",
    "No-Additional-Cost Services",
    "Partnership entity optimization",
    "Passive Real Estate Losses",
    "PIGs vs PALs (Passive Income Generators vs Passive Activity Losses)",
    "PTE/PTET (Pass-Through Entity Tax)",
    "QBI (Qualified Business Income) Optimization",
  ],
];

export const additionalCostStrategyColumns = [
  [
    "Accident and Health Benefits Plan",
    "Buy-Sell Agreement Planning",
    "Cafeteria Plans",
    "Captive Insurance",
    "Cash Balance Plan",
    "Charitable Gift Financing",
    "Charitable Holding LLC",
    "Charitable Lead Annuity Trusts (CLAT's)",
    "Charitable Pooled Income Fund",
    "Charitable Remainder Trust (CRT)",
    "Cost Segregation",
    "Deferred Compensation Plan (Individual)",
    "Deferred Sales Trust",
    "Defined Benefit Plan",
  ],
  [
    "Delaware Statutory Trusts (DSTs)",
    "Film Debt Financing",
    "Film Deduction (IRC 181)",
    "Financed Business Insurance",
    "Grantor Retained Annuity Trust (GRAT)",
    "Group-Term Life Insurance Coverage",
    "Leveraged Charitable Deductions",
    "Life Insurance Cost Reduction Strategy",
    "MERP (Medical Expense Reimbursement Plan)",
    "New Markets Tax Credits (NMTC)",
    "Private Family Foundation",
    "Private Foundation",
    "Profit-Sharing Plan",
    "Qualified Charitable Distributions (QCDs)",
  ],
];

export const estimatedTaxRows = [
  {
    label: "Federal",
    before: "Calculated from current records",
    after: "Updated after accepted strategies",
    savings: "Depends on eligibility",
  },
  {
    label: "State",
    before: "Reviewed by filing state",
    after: "Adjusted for state treatment",
    savings: "Varies by jurisdiction",
  },
  {
    label: "Total tax",
    before: "Current projection",
    after: "Revised projection",
    savings: "Reviewed with client",
    total: true,
  },
];

export const estimatedTaxInputs = [
  ["Taxpayer profile", "Confirmed during discovery"],
  ["Tax year", "Current planning year"],
  ["Filing status", "Confirmed from client facts"],
  ["Income sources", "Wages, business income, investments, or other income"],
  ["Deduction profile", "Standard or itemized review"],
  ["Credits and adjustments", "Reviewed against eligibility"],
  ["Withholding and estimates", "Compared against projected tax"],
  ["State considerations", "Reviewed by filing state"],
];

export const clientResponsibilities = [
  "Provide key information required to complete the tax planning engagement",
  "Take action on agreed upon next steps",
  "Be transparent & honest with setbacks to help determine the right tax strategies",
  "Contact us before making major financial decisions",
  "Come prepared with action steps taken on each quarterly planning meeting",
];

export const actionItems = [
  "Review the document request list sent by Ella Tax Services.",
  "Upload the requested records and answer open planning questions.",
];

export const nextSteps = {
  forYou: [
    "Review the request list and provide records",
    "Attend the planning call and confirm agreed next steps",
  ],
  forUs: ["Review documents in detail", "Build tax plan", "Present tax plan"],
};

export const individualStrategies = [
  "Retirement planning",
  "Education planning",
  "Itemized deductions",
  "Charitable giving",
  "Estimated taxes",
  "Credit review",
  "Filing status",
];

export const businessStrategies = [
  "Cash flow planning",
  "Home office",
  "Business travel",
  "Business meals",
  "Vehicle expenses",
];
