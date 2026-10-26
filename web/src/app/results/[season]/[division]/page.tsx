import { sectionPage } from "@/lib/sectionPage";

const { generateStaticParams, generateMetadata, Page } = sectionPage("results");

// Every season and division is built ahead of time; anything else is a 404.
export const dynamicParams = false;
export { generateStaticParams, generateMetadata };
export default Page;
