export enum WebsiteType {
  TECHSAHAYATA = "techsahayata",
  VDPROPERTIES = "vdproperties",
  WORKFLOW = "workflow",
  SCHOOL_MANAGEMENT = "school_management"
}

export const WEBSITE_DOMAINS = [
  {
    id: WebsiteType.TECHSAHAYATA,
    name: "TechSahayata",
    domain: "https://techsahayata.com"
  },
  {
    id: WebsiteType.VDPROPERTIES,
    name: "VD Properties",
    domain: "https://vdproperties.com.au"
  },
  {
    id: WebsiteType.WORKFLOW,
    name: "Workflow",
    domain: "https://workflow.com"
  },
  {
    id: WebsiteType.SCHOOL_MANAGEMENT,
    name: "School Management",
    domain: "https://school-managent.vercel.app"
  }
];
