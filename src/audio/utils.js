export const summarize = (pixelWidth, rawAudioData) => {
    const samplesPerPixel = Math.round(rawAudioData.length / pixelWidth);
    let buffer = [...rawAudioData]
    let summary = [];
    let max = 0;
    for (let i = 0; i < pixelWidth; i++) {
        let pos = 0;
        let neg = 0;

        for (let j = 0; j < samplesPerPixel; j++) {
            const sample = buffer[i * samplesPerPixel + j];
            if (sample === undefined) {
                break;
            }
            if (sample > 0) {
                pos += sample;
            } else {
                neg += sample;
            }
        }
        const avgNeg = neg/samplesPerPixel;
        const avgPos = pos/samplesPerPixel;
        max = Math.max(Math.abs(avgNeg), avgPos, max);
        summary.push([avgNeg, avgPos]);
    }

    for (let i = 0; i < summary.length; i++) {
        const [negative, positive] = summary[i];
        summary[i] = [negative/max, positive/max];
    }

    return summary;
}

// export const summarizeRMS = (pixelWidth, rawAudioData) => {
//     const samplesPerPixel = Math.round(rawAudioData.length / pixelWidth);
//     let buffer = [...rawAudioData]
//     let summary = [];
//     let max = 0;
//     for (let i = 0; i < pixelWidth; i++) {
//         let total = 0;
//         let count = 0;
//         for (let j = 0; j < samplesPerPixel; j++) {
//             const sample = buffer[i * samplesPerPixel + j];
//             if (sample === undefined) {
//                 break;
//             }
//             total += sample;
//             count++;
//         }
//         const rms = Math.sqrt(total/count);
//         max = Math.max(rms, max);
//         summary.push(rms);
//     }

//     console.log(summary);

//     // normalize
//     for (let i = 0; i < summary.length; i++) {
//         summary[i] = summary[i]/max;
//     }
//     console.log(summary);

//     return summary;
// }
