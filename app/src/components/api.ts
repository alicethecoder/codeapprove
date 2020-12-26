import { Vue } from "vue-property-decorator";

export type PullRequestAPI = Vue & {
  onNextFile(): void;
  onPrevFile(): void;
  onToggleFile(): void;
};

export type ChangeEntryAPI = Vue & {
  activate(): void;
  deactivate(): void;

  expand(): void;
  collapse(): void;
  toggle(): void;

  nextLine(): void;
  prevLine(): void;
  addLineComment(): void;
};

export type DiffLineAPI = Vue & {
  activate(): void;
  deactivate(): void;
  addComment(): void;
};

export type CommentThreadAPI = Vue & {
  addComment(resolve?: boolean): Promise<any>;
};

export type LabeledSelectAPI = Vue & {
  setSelected(key?: string): void;
};
