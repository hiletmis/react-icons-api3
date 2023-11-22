const chains = require('@api3/chains');
const fs = require('fs/promises');
const rimraf = require('rimraf');
const svgr = require('@svgr/core').default;
const camelcase = require('camelcase');
const babel = require('@babel/core');

const outputPath = './dist';

async function transformSVGtoJSX(file, componentName, format) {
    const content = await fs.readFile(`./optimized/${file}`, 'utf-8');
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
    return content;
}

async function buildIcons(format = 'esm') {
    let outDir = `${outputPath}/${format}`;

    await fs.mkdir(outDir, { recursive: true });

    const files = await fs.readdir('./optimized', 'utf-8');

    chains.CHAINS.forEach(async (chain) => {
        const file = files.find(file => file.includes(`Chain${chain.id}`))
        let fileName = file;

        if (!fileName) {
            console.log(`Chain ${chain.id} not found`)
            return
        }

        const componentName = `${camelcase(fileName.replace(/.svg/, ''), {
            pascalCase: true,
        })}Icon`;
        const content = await transformSVGtoJSX(fileName, componentName, format);
        const types = `import * as React from 'react';\ndeclare function ${componentName}(props: React.SVGProps<SVGSVGElement>): JSX.Element;\nexport default ${componentName};\n`;

        // console.log(`- Creating file: ${componentName}.js`);
        await fs.writeFile(`${outDir}/${componentName}.js`, content, 'utf-8');
        await fs.writeFile(`${outDir}/${componentName}.d.ts`, types, 'utf-8');

    })

    const types = `import * as React from 'react';\ndeclare function Chains(props: React.SVGProps<SVGSVGElement>): JSX.Element;\nexport default Chains;\n`;
    await fs.writeFile(
        `${outDir}/Chains.d.ts`,
        types,
        'utf-8'
    )
    let { code } = await babel.transformAsync(`
        import * as React from "react";
        import Chain43113Icon from './Chain43113Icon';
        import Chain11155111Icon from './Chain11155111Icon';
        
        function Chains(props) {
            switch (props.id) {
                case "43113":
                    return <Chain43113Icon {...props} />;
                case "11155111":
                    return <Chain11155111Icon {...props} />;
                default:
                    return <Chain43113Icon {...props} />;
            }
        }

        export default Chains;
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
        `${outDir}/Chains.js`,
        code,
        'utf-8'
    )

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




(function main() {
    console.log('🏗 Building icon package...');
    new Promise((resolve) => {
        rimraf(`${outputPath}/*`, resolve);
    })
        .then(() => Promise.all([buildIcons('cjs'), buildIcons('esm')]))
        .then(() => console.log('✅ Finished building package.'));
})();