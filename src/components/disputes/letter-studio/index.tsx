/**
 * Letter Studio - WYSIWYG Document Composition Experience
 *
 * A professional letter editing interface where "What You See Is What You Print"
 * Replaces the fragmented Letter Editor Modal with a unified document view.
 */

export { LetterStudio } from "./letter-studio";
export { LetterStudioModal } from "./letter-studio-modal";
export { LetterDocument } from "./letter-document";
export { AmeliaPanel } from "./amelia-panel";
export { SectionNavigator } from "./section-navigator";

// Section Components
export { HeaderSection } from "./sections/header-section";
export { TitleSection } from "./sections/title-section";
export { StorySection } from "./sections/story-section";
export { BodySection } from "./sections/body-section";
export { AccountsSection } from "./sections/accounts-section";
export { PersonalSection } from "./sections/personal-section";
export { ClosingSection } from "./sections/closing-section";

// Types - DocumentSection is also defined in letter-studio.tsx
export type { DocumentSection } from "./letter-document";
export type { SectionStatus, LetterStudioProps, GeneratedLetter } from "./letter-studio";
