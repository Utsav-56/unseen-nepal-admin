#!/usr/bin/env node

/**
 * Benchmark Summary Generator
 * 
 * Generates a summary of all benchmark results and compares performance trends
 */

const fs = require('fs');
const path = require('path');

const resultsDir = './benchmark-results';

if (!fs.existsSync(resultsDir)) {
    console.log('No benchmark results found. Run tests first: npm run test:benchmark');
    process.exit(0);
}

const files = fs.readdirSync(resultsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

if (files.length === 0) {
    console.log('No benchmark results found.');
    process.exit(0);
}

let summary = `# Benchmark Results Summary\n\n`;
summary += `Generated: ${new Date().toISOString()}\n\n`;

// Read latest results
const latestFile = files[0];
const latestData = JSON.parse(fs.readFileSync(path.join(resultsDir, latestFile), 'utf-8'));

summary += `## Latest Run: ${path.basename(latestFile, '.json')}\n\n`;
summary += `**Total Time**: ${latestData.totalSuiteTime.toFixed(2)}ms\n`;
summary += `**Test Count**: ${latestData.results.length}\n\n`;

// Benchmark table
summary += `### Performance Metrics\n\n`;
summary += `| Test | Iterations | Avg (ms) | Min (ms) | Max (ms) | Memory (MB) |\n`;
summary += `|------|-----------|----------|---------|---------|-------------|\n`;

let totalAvg = 0;
latestData.results.forEach(result => {
    summary += `| ${result.name} | ${result.iterations} | ${result.averageTime.toFixed(3)} | ${result.minTime.toFixed(3)} | ${result.maxTime.toFixed(3)} | ${result.memoryUsed.toFixed(2)} |\n`;
    totalAvg += result.averageTime;
});

summary += `\n`;

// Performance analysis
summary += `## Performance Analysis\n\n`;

const avgPerOp = totalAvg / latestData.results.length;
summary += `- **Overall Average**: ${avgPerOp.toFixed(3)}ms\n`;
summary += `- **Fastest Test**: ${Math.min(...latestData.results.map(r => r.averageTime)).toFixed(3)}ms\n`;
summary += `- **Slowest Test**: ${Math.max(...latestData.results.map(r => r.averageTime)).toFixed(3)}ms\n`;

// Check for regressions
if (files.length > 1) {
    summary += `\n## Trend Analysis\n\n`;
    
    const previousFile = files[1];
    const previousData = JSON.parse(fs.readFileSync(path.join(resultsDir, previousFile), 'utf-8'));
    
    summary += `### Comparison with Previous Run\n\n`;
    summary += `| Test | Previous (ms) | Current (ms) | Change | Status |\n`;
    summary += `|------|--------------|-------------|--------|--------|\n`;
    
    latestData.results.forEach((result, idx) => {
        const previousResult = previousData.results[idx];
        if (!previousResult) return;
        
        const change = result.averageTime - previousResult.averageTime;
        const changePercent = ((change / previousResult.averageTime) * 100).toFixed(1);
        const status = change > 0 ? '⚠️ Slower' : '✅ Faster';
        
        summary += `| ${result.name} | ${previousResult.averageTime.toFixed(3)} | ${result.averageTime.toFixed(3)} | ${change > 0 ? '+' : ''}${change.toFixed(3)} (${changePercent}%) | ${status} |\n`;
    });
}

// Performance targets
summary += `\n## Performance Targets\n\n`;
summary += `| Operation | Target | Current | Status |\n`;
summary += `|-----------|--------|---------|--------|\n`;

const targets = {
    'getState()': 0.1,
    'getter': 0.05,
    'setState': 0.1,
    'filter': 1,
    'set array': 1,
};

Object.entries(targets).forEach(([op, target]) => {
    const result = latestData.results.find(r => r.name.toLowerCase().includes(op.toLowerCase()));
    if (result) {
        const status = result.averageTime <= target ? '✅' : '⚠️';
        summary += `| ${op} | ${target}ms | ${result.averageTime.toFixed(3)}ms | ${status} |\n`;
    }
});

summary += `\n## Recent Runs\n\n`;
summary += `| Date | Suite | Avg Time | Results |\n`;
summary += `|------|-------|----------|----------|\n`;

files.slice(0, 10).forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf-8'));
    const avgTime = (data.results.reduce((a, r) => a + r.averageTime, 0) / data.results.length).toFixed(3);
    summary += `| ${path.basename(file, '.json')} | ${data.name} | ${avgTime}ms | ${data.results.length} tests |\n`;
});

// Save summary
const summaryPath = path.join(resultsDir, 'SUMMARY.md');
fs.writeFileSync(summaryPath, summary);

console.log('\n' + summary);
console.log(`\n✅ Summary saved to ${summaryPath}`);
