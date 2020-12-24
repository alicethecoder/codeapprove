module.exports = {
  important: false,
  purge: {
    enabled: process.env.NODE_ENV === "production",
    content: ["./src/*.vue", "./components/**/*.vue"]
  },
  theme: {
    fontFamily: {
      // TODO(polish): Probably make these fall back on the standards: https://tailwindcss.com/docs/font-family#app
      display: ["Rubik", "sans-serif"],
      body: ["Roboto", "sans-serif"]
    },
    extend: {
      colors: {
        dark: {
          // https://www.w3schools.com/colors/colors_mixer.asp
          "0": "#201d23",
          "1": "#221f25", // Center
          "2": "#252228",
          "3": "#28252b",
          "4": "#2a272d",
          "5": "#2d2a30",
          "6": "#302d33",
          "7": "#323036",
          "8": "#353338",
          "9": "#38353b"
        },
        wht: {
          brt: "rgba(255,255,255,0.87)",
          med: "rgba(255,255,255,0.60)",
          dim: "rgba(255,255,255,0.38)"
        }
      }
    }
  },
  variants: {
    shadow: ["hover"]
  }
};
