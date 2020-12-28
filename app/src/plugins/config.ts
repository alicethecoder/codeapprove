import { ClientGitHubConfig } from "../../../shared/types";

export interface Config {
  version: number;
  firebase: {
    apiKey: string;
    authDomain: string;
    databaseURL: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId: string;
  };
  github: ClientGitHubConfig;
}

export const config: Config = {
  version: 1,
  firebase: {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
  },
  github: {
    app_name: "",
    app_id: 0,
    app_url: "",
    client_id: "",
    redirect: ""
  }
};

if (process.env.NODE_ENV !== "production") {
  // DEV CONFIG
  config.firebase = {
    apiKey: "AIzaSyD4q0LrrYH6MTq3YQTqBKyrSiDlkwXEMgg",
    authDomain: "codeapprove-dev.firebaseapp.com",
    databaseURL: "https://codeapprove-dev.firebaseio.com",
    projectId: "codeapprove-dev",
    storageBucket: "codeapprove-dev.appspot.com",
    messagingSenderId: "533117593232",
    appId: "1:533117593232:web:2a88fbd5279226937b9a15",
    measurementId: "G-ZDHW48NFJY"
  };

  config.github = {
    app_name: "codeapprove-dev",
    app_id: 70622,
    app_url: "https://github.com/apps/codeapprove-dev",
    client_id: "Iv1.3bfe017ea9365f15",
    redirect: "http://localhost:5000/api/oauth"
  };
} else {
  // PROD CONFIG
  config.firebase = {
    apiKey: "AIzaSyCbvfm75CxBT13fSDSa4GQN3o_LLzVKJO0",
    authDomain: "codeapprove-prod.firebaseapp.com",
    databaseURL: "https://codeapprove-prod.firebaseio.com",
    projectId: "codeapprove-prod",
    storageBucket: "codeapprove-prod.appspot.com",
    messagingSenderId: "433773763706",
    appId: "1:433773763706:web:a8a422eacff49dea72afc3",
    measurementId: "G-5DQ43FZZ3R"
  };

  config.github = {
    app_name: "codeapprove",
    app_id: 66242,
    app_url: "https://github.com/apps/codeapprove",
    client_id: "Iv1.6163c34dcb65f972",
    redirect: "https://codeapprove.com/api/oauth"
  };
}
