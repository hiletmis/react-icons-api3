const chains = require('@api3/chains');
const fs = require('fs/promises');
const rimraf = require('rimraf');
const svgr = require('@svgr/core').default;
const camelcase = require('camelcase');
const babel = require('@babel/core');

const outputPath = './dist';

async function transformSVGtoJSX(file, componentName, format, dir) {
    const content = await fs.readFile(`${dir}/${file}`, 'utf-8');
    const svgReactContent = await svgr(
        content,
        {
            icon: false,
            replaceAttrValues: { '#00497A': "{props.color || '#00497A'}" },
            svgProps: {
                width: 32,
                height: 32,
            },
        },
        { componentName }
    );

    let { code } = await babel.transformAsync(svgReactContent, {
        presets: [['@babel/preset-react', { useBuiltIns: true }]],
    });


    if (format === 'esm') {
        return code;
    }

    const replaceESM = code
        .replace(
            'import * as React from "react";',
            'const React = require("react");'
        )
        .replace('export default', 'module.exports =');
    return replaceESM;
}

function indexFileContent(format, batchName) {
    let result = format === 'esm' ? `export { default as ChainIcon } from './ChainIcon';\n` : `module.exports.ChainIcon = require('./ChainIcon.js');\n`;
    return result += format === 'esm' ? `export { default as SymbolIcon } from './SymbolIcon';\n` : `module.exports.SymbolIcon = require('./SymbolIcon.js');\n`;
}

async function buildChainIcons(files, iconsDir, format = 'esm', dir) {

    chains.CHAINS.forEach(async (chain) => {
        const file = files.find(file => file.includes(`Chain${chain.id}.svg`))
        let fileName = file;

        if (!fileName) {
            console.log(`- Chain ${chain.id} not found`);
            return
        }

        const componentName = `${camelcase(fileName.replace(/.svg/, ''), {
            pascalCase: true,
        })}Icon`;

        const content = await transformSVGtoJSX(fileName, componentName, format, dir);
        const types = `import * as React from 'react';\ndeclare function ${componentName}(props: React.SVGProps<SVGSVGElement>): JSX.Element;\nexport default ${componentName};\n`;

        // console.log(`- Creating file: ${componentName}.js`);
        await fs.writeFile(`${iconsDir}/${componentName}.js`, content, 'utf-8');
        await fs.writeFile(`${iconsDir}/${componentName}.d.ts`, types, 'utf-8');

    })
}

async function buildSymbolIcons(files, iconsDir, format = 'esm', dir) {
    const symbols = ["BTC"]
    symbols.forEach(async (symbol) => {
        const file = files.find(file => file.includes(`${symbol}.svg`))
        let fileName = file;

        if (!fileName) {
            console.log(`- Symbol ${symbol} not found`);
            return
        }

        const componentName = `${camelcase(fileName.replace(/.svg/, ''), {
            pascalCase: true,
        })}Icon`;

        const content = await transformSVGtoJSX(fileName, componentName, format, dir);
        const types = `import * as React from 'react';\ndeclare function ${componentName}(props: React.SVGProps<SVGSVGElement>): JSX.Element;\nexport default ${componentName};\n`;

        // console.log(`- Creating file: ${componentName}.js`);
        await fs.writeFile(`${iconsDir}/${componentName}.js`, content, 'utf-8');
        await fs.writeFile(`${iconsDir}/${componentName}.d.ts`, types, 'utf-8');

    })
}

async function buildIcons(format = 'esm', dir, mode, batchName) {
    let outDir = `${outputPath}/${format}`;
    let iconsDir = `${outDir}/icons/${mode || ''}`;

    await fs.mkdir(outDir, { recursive: true });
    await fs.mkdir(iconsDir, { recursive: true });

    const files = await fs.readdir(dir, 'utf-8');

    switch (mode) {
        case 'chains':
            await buildChainIcons(files, iconsDir, format, dir);
            break;
        case 'symbols':
            await buildSymbolIcons(files, iconsDir, format, dir);
            break;
        default:
            break;
    }

    await buildBatch(outDir, format, batchName, mode);
    await buildIndexFiles(outDir, [], format, batchName);

}

async function buildIndexFiles(outDir, files, format = 'esm', batchName) {
    console.log('- Creating file: index.js');
    await fs.writeFile(
        `${outDir}/index.js`,
        indexFileContent(format, batchName),
        'utf-8'
    );
    await fs.writeFile(
        `${outDir}/index.d.ts`,
        indexFileContent('esm', batchName),
        'utf-8'
    );
}

function buildSwitchCase(mode) {
    const symbols = ["BTC"]
    switch (mode) {
        case 'chains':
            return chains.CHAINS.map(chain => `case "${chain.id}":\n\treturn <Chain${chain.id}Icon {...props} />;\n`).join('')
        case 'symbols':
            return symbols.map(symbol => `case "${symbol}":\n\treturn <Symbol${symbol}Icon {...props} />;\n`).join('')
        default:
            break;
    }
}

function buildIconImports(mode) {
    const symbols = ["BTC"]

    switch (mode) {
        case 'chains':
            return chains.CHAINS.map(chain => `import Chain${chain.id}Icon from './icons/chains/Chain${chain.id}Icon';\n`).join('')
        case 'symbols':
            return symbols.map(symbol => `import Symbol${symbol}Icon from './icons/symbols/${symbol}Icon';\n`).join('')
        default:
            break;
    }
}

async function buildBatch(outDir, format = 'esm', batchName, mode) {

    const types = `import * as React from 'react';\ndeclare function ${batchName}(props: React.SVGProps<SVGSVGElement>): JSX.Element;\nexport default ${batchName};\n`;
    await fs.writeFile(
        `${outDir}/${batchName}.d.ts`,
        types,
        'utf-8'
    )

    const imports = `import * as React from "react";
        ${buildIconImports(mode)};\n\n`

    let { code } = await babel.transformAsync(`
        ${imports}
        
        function ${batchName}(props) {
            switch (props.id) {
                ${buildSwitchCase(mode)}
                default:
                    return null;
            }
        }
        export default ${batchName};
    `
        , {
            presets: [['@babel/preset-react', { useBuiltIns: true }]],
        });

    if (format === 'cjs') {
        code = code
            .replace(
                'import * as React from "react";',
                'const React = require("react");'
            )
            .replace('export default', 'module.exports =');
    }

    await fs.writeFile(
        `${outDir}/${batchName}.js`,
        code,
        'utf-8'
    )
}

async function generateIcons(format = 'esm') {
    await buildIcons(format, './optimized/chains', 'chains', 'ChainIcon');
    await buildIcons(format, './optimized/symbols', 'symbols', 'SymbolIcon');
}

(function main() {
    console.log('🏗 Building icon package...');
    new Promise((resolve) => {
        rimraf(`${outputPath}/*`, resolve);
    })
        .then(() => Promise.all([generateIcons('cjs'), generateIcons('esm')]))
        .then(() => console.log('✅ Finished building package.'));
})();