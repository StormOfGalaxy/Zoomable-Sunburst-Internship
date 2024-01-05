import * as d3 from 'd3';

import data from '/data/data.json';

// Specify the chart’s dimensions.
const width = 928;
const height = width;
const radius = width / 12;

// Create the color scale.
const color = d3.scaleOrdinal(
  d3.quantize(d3.interpolateRainbow, data.children.length + 1)
);

// Compute the layout.
const hierarchy = d3
  .hierarchy(data)
  .sum((d) => d.value)
  .sort((a, b) => b.value - a.value);

const root = d3.partition().size([2 * Math.PI, hierarchy.height + 1])(
  hierarchy
);
root.each((d) => (d.current = d));

// Create the arc generator.
const arc = d3
  .arc()
  .startAngle((d) => d.x0)
  .endAngle((d) => d.x1)
  .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
  .padRadius(radius * 1.5)
  .innerRadius((d) => d.y0 * radius)
  .outerRadius((d) => Math.max(d.y0 * radius, d.y1 * radius - 1));

// Create the SVG container.
const svg = d3
  .create('svg')
  .attr('viewBox', [-width / 2, -height / 2, width, width])
  .style('font', '7.5px sans-serif');

// Append the arcs.
const path = svg
  .append('g')
  .selectAll('path')
  .data(root.descendants().slice(1))
  .join('path')
  .attr('fill', (d) => {
    while (d.depth > 1) d = d.parent;
    return color(d.data.name);
  })
  .attr('fill-opacity', (d) =>
    arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0
  )
  .attr('pointer-events', (d) => (arcVisible(d.current) ? 'auto' : 'none'))

  .attr('d', (d) => arc(d.current));

// Make them clickable if they have children.
path
  .filter((d) => d.children)
  .style('cursor', 'pointer')
  .on('click', clicked);

const format = d3.format(',d');
// Tooltip (box if you hover over a chart)
path.append('title').text(
  (d) =>
    `${d
      .ancestors()
      .map((d) => d.data.name)
      .reverse()
      .join('/')}\n${format(d.value)}`
);

const label = svg
  .append('g')
  .attr('pointer-events', 'none')
  .attr('text-anchor', 'middle')
  .style('user-select', 'none')
  .selectAll('text')
  .data(root.descendants().slice(1))
  .join('text')
  .attr('dy', '0.35em')
  .attr('fill-opacity', (d) => +labelVisible(d.current))
  .attr('transform', (d) => labelTransform(d.current))
  .text((d) => d.data.name);

const parent = svg
  .append('g')
  .datum({})
  .attr('pointer-events', 'all')
  .on('click', clicked);

const backIconSVGString = `<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 512 512"><path opacity="1" fill="#1E3050" d="M41.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 256 246.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160zm352-160l-160 160c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L301.3 256 438.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0z"/></svg>`;

const backIconWidth = 16;
const backIconHeight = 16;

const backIcon = parent
  .append('image')
  .attr(
    'xlink:href',
    'data:image/svg+xml,' + encodeURIComponent(backIconSVGString)
  )
  .attr('width', backIconWidth)
  .attr('height', backIconHeight)
  .attr('x', -backIconWidth / 2)
  .attr('y', -backIconHeight / 2)
  .style('cursor', 'pointer');

const backText = parent
  .append('text')
  .text('Back')
  .attr('text-anchor', 'middle')
  .attr('dy', backIconHeight / 2 + 10);

hideBack();
parent.on('click', null);

// Handle zoom on click.
function clicked(event, p) {
  parent.datum(p.parent || root);

  root.each(
    (d) =>
      (d.target = {
        x0:
          Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        x1:
          Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        y0: Math.max(0, d.y0 - p.depth),
        y1: Math.max(0, d.y1 - p.depth),
      })
  );

  const t = svg.transition().duration(750);

  // Transition the data on all arcs, even the ones that aren’t visible,
  // so that if this transition is interrupted, entering arcs will start
  // the next transition from the desired position.
  path
    .transition(t)
    .tween('data', (d) => {
      const i = d3.interpolate(d.current, d.target);
      return (t) => (d.current = i(t));
    })
    .filter(function (d) {
      return +this.getAttribute('fill-opacity') || arcVisible(d.target);
    })
    .attr('fill-opacity', (d) =>
      arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0
    )
    .attr('pointer-events', (d) => (arcVisible(d.target) ? 'auto' : 'none'))

    .attrTween('d', (d) => () => arc(d.current));

  label
    .filter(function (d) {
      return +this.getAttribute('fill-opacity') || labelVisible(d.target);
    })
    .transition(t)
    .attr('fill-opacity', (d) => +labelVisible(d.target))
    .attrTween('transform', (d) => () => labelTransform(d.current));

  if (p === root) {
    hideBack();
  } else {
    showBack();
  }
}

function hideBack() {
  parent
    .select('image')
    .attr(
      'xlink:href',
      root.parent === null
        ? ''
        : 'data:image/svg+xml,' + encodeURIComponent(backIconSVGString)
    );
  parent.select('text').text(root.parent === null ? '' : 'Back');

  parent.select('image').style('cursor', 'default');
  parent.select('text').style('cursor', 'default');
  parent.on('click', null);
}

function showBack() {
  parent
    .select('image')
    .attr(
      'xlink:href',
      root.parent !== null
        ? ''
        : 'data:image/svg+xml,' + encodeURIComponent(backIconSVGString)
    );
  parent.select('text').text(root.parent !== null ? '' : 'Back');

  parent.select('image').style('cursor', 'pointer');
  parent.select('text').style('cursor', 'pointer');
  parent.on('click', clicked);
}

function arcVisible(d) {
  return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
}

function labelVisible(d) {
  return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
}

function labelTransform(d) {
  const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
  const y = ((d.y0 + d.y1) / 2) * radius;
  return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
}

container.append(svg.node());
