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

function indexFileContent(files, format, includeExtension = true) {
    let content = '';
    const extension = includeExtension ? '.js' : '';
    files.map((fileName) => {
        const componentName = `${camelcase(fileName.replace(/.svg/, ''), {
            pascalCase: true,
        })}Icon`;
        const directoryString = `'./${componentName}${extension}'`;
        content +=
            format === 'esm'
                ? `export { default as ${componentName} } from ${directoryString};\n`
                : `module.exports.${componentName} = require(${directoryString});\n`;
    });

    content += format === 'esm' ? `export { default as ChainIcon } from './ChainIcon';\n` : `module.exports.ChainIcon = require('./ChainIcon.js');\n`;

    return content;
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

async function buildIcons(format = 'esm', dir, mode, batchName) {
    let outDir = `${outputPath}/${format}`;
    let iconsDir = `${outDir}/icons/${mode || ''}`;

    await fs.mkdir(outDir, { recursive: true });
    await fs.mkdir(iconsDir, { recursive: true });

    const files = await fs.readdir(dir, 'utf-8');

    await buildChainIcons(files, iconsDir, format, dir);

    await buildBatch(outDir, format, batchName);
    await buildIndexFiles(outDir, [], format);

}

async function buildIndexFiles(outDir, files, format = 'esm') {
    console.log('- Creating file: index.js');
    await fs.writeFile(
        `${outDir}/index.js`,
        indexFileContent(files, format),
        'utf-8'
    );
    await fs.writeFile(
        `${outDir}/index.d.ts`,
        indexFileContent(files, 'esm', false),
        'utf-8'
    );
}

async function buildBatch(outDir, format = 'esm', batchName) {

    const types = `import * as React from 'react';\ndeclare function ChainIcon(props: React.SVGProps<SVGSVGElement>): JSX.Element;\nexport default ChainIcon;\n`;
    await fs.writeFile(
        `${outDir}/${batchName}.d.ts`,
        types,
        'utf-8'
    )

    const iconImports = chains.CHAINS.map(chain => `import Chain${chain.id}Icon from './icons/chains/Chain${chain.id}Icon';\n`).join('')

    const imports = `import * as React from "react";
        ${iconImports};\n\n`

    const switchCase = chains.CHAINS.map(chain => `case "${chain.id}":\n\treturn <Chain${chain.id}Icon {...props} />;\n`).join('')

    let { code } = await babel.transformAsync(`
        ${imports}
        
        function ${batchName}(props) {
            switch (props.id) {
                ${switchCase}
                default:
                    return <Chain43113Icon {...props} />;
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
}

(function main() {
    console.log('🏗 Building icon package...');
    new Promise((resolve) => {
        rimraf(`${outputPath}/*`, resolve);
    })
        .then(() => Promise.all([generateIcons('cjs'), generateIcons('esm')]))
        .then(() => console.log('✅ Finished building package.'));
})();