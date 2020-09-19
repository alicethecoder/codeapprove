import Vue from "vue";
import { Module, VuexModule, Mutation, Action } from "vuex-module-decorators";
import * as uuid from "uuid";
import {
  Comment,
  CommentUser,
  Thread,
  ThreadArgs,
  threadMatch,
  Review,
  ReviewMetadata,
  Side,
  ThreadContentArgs
} from "@/model/review";
import * as events from "../../plugins/events";
import { NEW_COMMENT_EVENT, AddCommentEvent } from "../../plugins/events";

// TODO: Namespacing?
@Module({
  name: "review"
})
export default class ReviewModule extends VuexModule {
  // UI State related to the review (not persisted)
  public reviewState = {
    base: "unknown",
    head: "unknown"
  };

  // The review itself
  public review: Review = {
    metadata: {
      owner: "unknown",
      repo: "unknown",
      number: 0
    },
    reviewers: {},
    threads: [],
    comments: []
  };

  get drafts() {
    return this.review.comments.filter(x => x.draft);
  }

  get commentsByThread() {
    return (threadId: string) => {
      return this.review.comments.filter(x => x.threadId === threadId);
    };
  }

  get threadById() {
    return (threadId: string) => {
      return this.review.threads.find(x => x.id === threadId) || null;
    };
  }

  get threadByArgs() {
    return (args: ThreadArgs | null) => {
      if (args === null) {
        return null;
      }
      return this.review.threads.find(t => threadMatch(t, args)) || null;
    };
  }

  get threadsByFileAndSha() {
    return (file: string, sha: string) => {
      return this.review.threads.filter(x => x.file === file && x.sha === sha);
    };
  }

  @Mutation
  public initializeReview(metadata: ReviewMetadata) {
    // TODO: Should this be an action which pulls down information?
    // TODO: Should this set up reviewState
    this.review = {
      metadata,
      reviewers: {},
      threads: [],
      comments: []
    };
  }

  @Mutation
  public pushThread(thread: Thread) {
    console.log(`pushThread(${thread.id})`);
    this.review.threads.push(thread);
  }

  @Mutation
  public pushComment(comment: Comment) {
    console.log(`pushComment(${comment.id})`);
    this.review.comments.push(comment);

    // TODO: Is there a way I could automate this?
    events.emit(NEW_COMMENT_EVENT, { threadId: comment.threadId });
  }

  @Mutation
  public setThreadPendingState(opts: { threadId: string; resolved: boolean }) {
    const thread = this.review.threads.find(x => x.id === opts.threadId);
    if (thread) {
      thread.pendingResolved = opts.resolved;
    }
  }

  @Mutation
  public removeDraftStatus() {
    for (const thread of this.review.threads) {
      thread.draft = false;
      thread.resolved = thread.pendingResolved;
    }

    for (const comment of this.review.comments) {
      comment.draft = false;
    }
  }

  @Mutation
  public pushReviewer(opts: { login: string; approved: boolean }) {
    // Makes the new map key reactive
    Vue.set(this.review.reviewers, opts.login, opts.approved);
  }

  @Mutation
  public removeReviewer(opts: { login: string }) {
    // Makes the removed map key reactive
    Vue.delete(this.review.reviewers, opts.login);
  }

  @Mutation
  public setBaseAndHead(opts: { base: string; head: string }) {
    console.log(`review#setBaseAndHead(${opts.base}, ${opts.head})`);
    this.reviewState.base = opts.base;
    this.reviewState.head = opts.head;
  }

  @Action
  public newThread(opts: { args: ThreadArgs; ca: ThreadContentArgs }): Thread {
    console.log(`newThread(${JSON.stringify(opts)})`);
    const thread: Thread = {
      id: uuid.v4(),
      resolved: false,
      pendingResolved: false,
      draft: true,
      ...opts.args,
      ...opts.ca
    };

    // TODO: Network and shit
    this.context.commit("pushThread", thread);
    return thread;
  }

  @Action
  public async newComment(opts: {
    threadId: string;
    user: CommentUser;
    text: string;
  }): Promise<Comment> {
    console.log(`newComment(${JSON.stringify(opts)})`);
    const comment: Comment = {
      id: uuid.v4(),
      threadId: opts.threadId,
      username: opts.user.username,
      photoURL: opts.user.photoURL,
      text: opts.text,

      timestamp: new Date().toISOString(),
      draft: true
    };

    // TODO: Network and shit
    this.context.commit("pushComment", comment);
    return comment;
  }

  @Action
  public async sendDraftComments() {
    // TODO: Network and shit
    this.context.commit("removeDraftStatus");
  }

  @Action
  public async handleAddCommentEvent(opts: {
    e: AddCommentEvent;
    user: CommentUser;
  }) {
    const e = opts.e;
    const threadArgs: ThreadArgs = {
      file: e.file,
      sha: e.sha,
      line: e.line
    };

    const threadContentArgs: ThreadContentArgs = {
      lineContent: e.lineContent
    };

    // TODO: Doing this inside the comment thread may help reactivity?
    let thread: Thread | null = this.threadByArgs(threadArgs);
    if (!thread) {
      thread = await this.newThread({
        args: threadArgs,
        ca: threadContentArgs
      });
    }

    // Add comment
    await this.newComment({
      threadId: thread.id,
      user: opts.user,
      text: e.content
    });

    // If resolution state specified, set that
    if (e.resolve != undefined) {
      this.context.commit("setThreadPendingState", {
        threadId: thread.id,
        resolved: e.resolve
      });
    }
  }
}
