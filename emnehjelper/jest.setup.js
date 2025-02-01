// class MutationObserver {
//     constructor(callback) {
//         this.callback = callback;
//     }
//     observe(target, options) {
//         // Mock observe method
//         console.log('Mocked observe called on:', target, options);
//     }
//     disconnect() {
//         // Mock disconnect method
//         console.log('Mocked disconnect called');
//     }
//     takeRecords() {
//         return []; // Mock the records
//     }
// }

// global.MutationObserver = MutationObserver;

// global.chrome = {
//     runtime: {
//         sendMessage: jest.fn(() => Promise.resolve({})), // Mocked to return a resolved promise
//     },
// };
