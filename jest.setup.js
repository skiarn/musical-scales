import '@testing-library/jest-dom'

// Mock window.AudioContext
window.AudioContext = jest.fn().mockImplementation(() => ({
  createAnalyser: jest.fn().mockReturnValue({
    connect: jest.fn(),
    disconnect: jest.fn(),
    fftSize: 2048,
    getFloatFrequencyData: jest.fn(),
  }),
  createOscillator: jest.fn(),
  // Add other audio-related mocks as needed
}))
