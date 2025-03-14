import axios from "axios";

// Hangman ASCII art stages
const hangmanStages = [
  `
   +---+
   |   |
       |
       |
       |
       |
=========`,
  `
   +---+
   |   |
   O   |
       |
       |
       |
=========`,
  `
   +---+
   |   |
   O   |
   |   |
       |
       |
=========`,
  `
   +---+
   |   |
   O   |
  /|   |
       |
       |
=========`,
  `
   +---+
   |   |
   O   |
  /|\\  |
       |
       |
=========`,
  `
   +---+
   |   |
   O   |
  /|\\  |
  /    |
       |
=========`,
  `
   +---+
   |   |
   O   |
  /|\\  |
  / \\  |
       |
=========`,
];

// Cache for API responses
const cache = {
  anime: { easy: [], hard: [] },
  character: { easy: [], hard: [] },
};

// Filter words based on difficulty
const filterByDifficulty = (words, type, difficulty) => {
  return words.filter((word) => {
    const length = word.length;
    if (difficulty === "easy") {
      return length >= 4 && length <= 8;
    } else {
      return length > 8;
    }
  });
};

// Fetch words from Jikan API
const fetchWords = async (type, difficulty) => {
  try {
    if (cache[type][difficulty].length > 0) {
      return cache[type][difficulty][
        Math.floor(Math.random() * cache[type][difficulty].length)
      ];
    }

    let endpoint = "";
    if (type === "anime") {
      endpoint = "https://api.jikan.moe/v4/top/anime";
    } else {
      endpoint = "https://api.jikan.moe/v4/top/characters";
    }

    const response = await axios.get(endpoint);
    const items = response.data.data;

    const words = items.map((item) =>
      type === "anime" ? item.title : item.name
    );

    cache[type][difficulty] = filterByDifficulty(words, type, difficulty);

    if (cache[type][difficulty].length === 0) {
      throw new Error("No words found for the given criteria");
    }

    return cache[type][difficulty][
      Math.floor(Math.random() * cache[type][difficulty].length)
    ];
  } catch (error) {
    console.error("Error fetching words:", error);
    throw error;
  }
};

// Game state management
class HangmanGame {
  constructor(word) {
    this.word = word.toLowerCase();
    this.guessedLetters = new Set();
    this.remainingGuesses = 6;
    this.startTime = Date.now();
  }

  // Make a guess
  makeGuess(letter) {
    letter = letter.toLowerCase();

    if (this.guessedLetters.has(letter)) {
      return { status: "duplicate", message: "Letter already guessed!" };
    }

    this.guessedLetters.add(letter);

    if (!this.word.includes(letter)) {
      this.remainingGuesses--;
      return {
        status: "wrong",
        message: "Letter not found in word!",
        stage: this.getStage(),
      };
    }

    if (this.hasWon()) {
      return { status: "win", message: "You won!" };
    }

    return {
      status: "correct",
      message: "Found the letter!",
      stage: this.getStage(),
    };
  }

  // Get current stage
  getStage() {
    return hangmanStages[6 - this.remainingGuesses];
  }

  // Get masked word - UPDATED to properly escape underscores for Discord
  getMaskedWord() {
    return this.word
      .split("")
      .map((char) => {
        // If character is a space, return multiple spaces for better formatting
        if (char === " ") {
          return "   "; // three spaces to maintain visual spacing
        }
        // If character is alphanumeric and guessed, show it
        if (
          /[a-z0-9]/i.test(char) &&
          this.guessedLetters.has(char.toLowerCase())
        ) {
          return char;
        }
        // If character is not alphanumeric (like punctuation), show it
        if (!/[a-z0-9]/i.test(char)) {
          return char;
        }
        // For unguessed letters, return escaped underscore
        return "\\_";
      })
      .join(" ");
  }

  // Check if game is won
  hasWon() {
    return this.word.split("").every(
      (char) =>
        // Consider non-alphanumeric characters as "guessed"
        !/[a-z0-9]/i.test(char) || this.guessedLetters.has(char.toLowerCase())
    );
  }

  // Check if game is lost
  hasLost() {
    return this.remainingGuesses <= 0;
  }

  // Get game status
  getStatus() {
    return {
      maskedWord: this.getMaskedWord(),
      remainingGuesses: this.remainingGuesses,
      guessedLetters: Array.from(this.guessedLetters).join(", "),
      stage: this.getStage(),
    };
  }
}

export { fetchWords, HangmanGame };
