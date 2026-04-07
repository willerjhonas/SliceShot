const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { pdfToPng } = require('pdf-to-png-converter');

/**
 * Agente Especialista em Slicing para Figma
 * Divide imagens verticais extensas em partes menores para preservar a qualidade no Figma.
 * @param {string} inputPath - Caminho do arquivo de entrada
 * @param {string} outputDir - Pasta de saída
 * @param {number} maxPartHeight - Altura máxima de cada fatia em pixels
 * @param {function} onProgress - Callback de progresso (opcional)
 */
async function sliceImage(inputPath, outputDir, maxPartHeight = 8000, onProgress = null) {
    let buffer;
    const ext = path.extname(inputPath).toLowerCase();

    if (ext === '.pdf') {
        if (onProgress) onProgress({ status: 'converting', message: 'Convertendo PDF para imagem...' });
        const pngPages = await pdfToPng(inputPath, {
            viewportScale: 2.0,
            outputType: 'buffer'
        });
        buffer = pngPages[0].content;
    } else {
        buffer = fs.readFileSync(inputPath);
    }

    const image = sharp(buffer);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    const numParts = Math.ceil(height / maxPartHeight);

    if (onProgress) onProgress({ status: 'start', total: numParts, width, height, message: `Dividindo em ${numParts} partes...` });

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (let i = 0; i < numParts; i++) {
        const top = i * maxPartHeight;
        const currentPartHeight = Math.min(maxPartHeight, height - top);

        const partNumber = (i + 1).toString().padStart(2, '0');
        const outputFileName = `parte-${partNumber}.png`;
        const outputPath = path.join(outputDir, outputFileName);

        await image
            .clone()
            .extract({ left: 0, top: top, width: width, height: currentPartHeight })
            .toFile(outputPath);

        if (onProgress) onProgress({ status: 'slice', current: i + 1, total: numParts, fileName: outputFileName, width, height: currentPartHeight });
    }

    if (onProgress) onProgress({ status: 'done', total: numParts, outputDir, message: 'Fatiamento concluído com sucesso!' });
    console.log('Fatiamento concluído com sucesso!');
}

// Execução via CLI ou padrão
if (require.main === module) {
    const args = process.argv.slice(2);
    const inputArg = args[0];
    const outputArg = args[1];
    const maxPartHeightArg = args[2] ? parseInt(args[2]) : 4000;

    const defaultInput = path.join(__dirname, '..', '..', 'data', 'scrnli_pJ8hrN1Y3FY39b.pdf');
    const inputPath = inputArg ? (path.isAbsolute(inputArg) ? inputArg : path.join(process.cwd(), inputArg)) : defaultInput;

    const baseName = path.basename(inputPath, path.extname(inputPath));
    const defaultOutput = path.join(__dirname, '..', 'data', baseName);
    const outputDir = outputArg && outputArg !== '""' ? (path.isAbsolute(outputArg) ? outputArg : path.join(process.cwd(), outputArg)) : defaultOutput;

    sliceImage(inputPath, outputDir, maxPartHeightArg)
        .catch(err => {
            console.error('Erro no processamento:', err);
            process.exit(1);
        });
}

module.exports = { sliceImage };

