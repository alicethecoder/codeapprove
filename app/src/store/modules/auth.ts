import { Module, VuexModule, Mutation, Action } from "vuex-module-decorators";
import { auth, functions } from "../../plugins/firebase";
import { User } from "../../model/auth";
import { AuthDelegate } from "../../../../shared/github";

// TODO: Namespacing?
@Module({
  name: "auth"
})
export default class AuthModule extends VuexModule {
  public signInKnown: boolean = false;
  public user: User | null = null;

  static getDelegate(module: AuthModule): AuthDelegate {
    return {
      getToken: () => module.assertUser.githubToken,
      getExpiry: () => module.assertUser.githubExpiry,
      refreshAuth: () => module.refreshGithubAuth()
    };
  }

  @Mutation
  restoreFromLocalStorage() {
    const userString = localStorage.getItem("user");
    if (userString == null) {
      this.user = null;
      return;
    }

    try {
      const user = JSON.parse(userString) as User;
      this.user = user;
      console.log("User restored");
    } catch (e) {
      console.log("Failed to parse user JSON");
      this.user = null;
    }

    this.signInKnown = true;
  }

  @Mutation
  setUser(u: User | null) {
    console.log(`auth.setUser(${u ? u.uid : null})`);
    this.signInKnown = true;
    this.user = u;

    localStorage.setItem("user", JSON.stringify(this.user));
  }

  @Mutation
  updateGithubToken(opts: { githubToken: string; githubExpiry: number }) {
    console.log("updateGithubToken", `expiry=${opts.githubExpiry}`);
    this.user!.githubToken = opts.githubToken;
    this.user!.githubExpiry = opts.githubExpiry;

    // TODO: Could I just call setUser?
    localStorage.setItem("user", JSON.stringify(this.user));
  }

  get assertUser(): User {
    return this.user!;
  }

  get signedIn(): boolean {
    return !!this.user;
  }

  // TODO: Maybe this shouldn't be here if it doesn't directly touch the state
  @Action
  async startSignOut() {
    await auth().signOut();
  }

  @Action
  async refreshGithubAuth() {
    console.log("refreshGithubAuth");
    const tokenRes = await functions().httpsCallable("getGithubToken")();
    const access_token = tokenRes.data.access_token;
    const access_token_expires = tokenRes.data.access_token_expires;
    this.context.commit("updateGithubToken", {
      githubToken: access_token,
      githubExpiry: access_token_expires
    });
  }
}
