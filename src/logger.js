import chalk from 'chalk';
import figures from 'figures';

const timestamp = () => chalk.dim(`[${new Date().toLocaleTimeString()}]`);

export const logger = {
  info: (msg) => console.log(`${timestamp()} ${chalk.cyan(figures.info)} ${msg}`),
  success: (msg) => console.log(`${timestamp()} ${chalk.green(figures.tick)} ${msg}`),
  warn: (msg) => console.log(`${timestamp()} ${chalk.yellow(figures.warning)} ${msg}`),
  error: (msg) => console.log(`${timestamp()} ${chalk.red(figures.cross)} ${msg}`),
  dim: (msg) => console.log(`${timestamp()} ${chalk.dim(msg)}`),
  blank: () => console.log(),

  banner: () => {
    console.log();
    console.log(chalk.bold.cyan('╔══════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('        🌐  ASSET  GRABBER  🌐        ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('║') + chalk.dim('   Download every asset from any site  ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════╝'));
    console.log();
  },

  summary: ({ url, total, downloaded, skipped, failed, outDir, elapsed }) => {
    console.log();
    console.log(chalk.bold.cyan('─'.repeat(50)));
    console.log(chalk.bold('📦 Download Summary'));
    console.log(chalk.bold.cyan('─'.repeat(50)));
    console.log(`  ${chalk.dim('Source URL  :')} ${chalk.white(url)}`);
    console.log(`  ${chalk.dim('Output Dir  :')} ${chalk.white(outDir)}`);
    console.log(`  ${chalk.dim('Total Found :')} ${chalk.white(total)}`);
    console.log(`  ${chalk.dim('Downloaded  :')} ${chalk.green(downloaded)}`);
    console.log(`  ${chalk.dim('Skipped     :')} ${chalk.yellow(skipped)}`);
    console.log(`  ${chalk.dim('Failed      :')} ${chalk.red(failed)}`);
    console.log(`  ${chalk.dim('Elapsed     :')} ${chalk.white(elapsed)}`);
    console.log(chalk.bold.cyan('─'.repeat(50)));
    console.log();
  },
};
