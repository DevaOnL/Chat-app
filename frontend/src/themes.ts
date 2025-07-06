export type Theme = {
  name: string;
  values: Record<string, string>;
};

export const themes: Theme[] = [
  {
    name: "Gruvbox",
    values: {
      "--bg": "#282828",
      "--fg": "#ebdbb2",
      "--dark-gray": "#3c3836",
      "--light-gray": "#a89984",
      "--yellow": "#d79921",
      "--green": "#b8bb26",
      "--blue": "#83a598",
      "--red": "#fb4934",
      "--orange": "#fe8019",
    }
  },
];
