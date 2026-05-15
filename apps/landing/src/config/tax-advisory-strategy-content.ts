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
  { label: "Federal", before: "$584,269", after: "$531,632", savings: "$52,638" },
  { label: "State", before: "$66,400", after: "$65,085", savings: "$1,315" },
  { label: "Total tax", before: "$650,669", after: "$596,717", savings: "$53,953", total: true },
];

export const estimatedTaxInputs = [
  ["Taxpayer name", "Sarah Jones"],
  ["Tax Year", "2025"],
  ["Are you a farmer/fisherman?", "No"],
  ["Tax Filing Status", "Married filing jointly ..."],
  ["Deductible type", "Standard"],
  ["Itemized amount", "$45,000", "Value should be $0"],
  ["Federal Wages", "$90,000"],
  [
    "Qualified dividends/capital gains",
    "$800,000",
    "Note Federal Capital gains in scope. Add the state cap gains tax when needed",
  ],
  ["Other federal adjustments", "$15,000"],
  ["Other federal credits", "$3,000"],
  ["Other federal taxes", "$5,000"],
  ["Federal taxes withheld", "$1,000"],
  ["Prior year federal estimated overpayments", "$2,000"],
];

export const clientResponsibilities = [
  "Provide key information required to complete the tax planning engagement",
  "Take action on agreed upon next steps",
  "Be transparent & honest with setbacks to help determine the right tax strategies",
  "Contact us before making major financial decisions",
  "Come prepared with action steps taken on each quarterly planning meeting",
];

export const actionItems = [
  "Will be sending over a request list of key items needed to begin the engagement.",
  "You will look for an email from Corvee and be able to see the items requested.",
];

export const nextSteps = {
  forYou: [
    "Sent request list with key info needed via Corvee",
    "Attend tax plan call and select strategies recommended by us",
  ],
  forUs: ["Review documents in detail", "Build tax plan", "Present tax plan"],
};

export const individualStrategies = [
  "Augusta Rule",
  "Child IRA & Roth",
  "Itemize",
  "No Tax on Tips",
  "No Tax on Overtime",
  "No Tax on Car Loan",
  "401K",
];

export const businessStrategies = [
  "Cash Plan",
  "Home Office",
  "Business Travel",
  "Business Meal",
  "Vehicle Expense",
];
