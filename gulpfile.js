#!/usr/bin/env node
'use strict'
process.argv.push('--color')
var gulp = require('gulp')
var babel = require('gulp-babel')
var standard = require('gulp-standard')
var sourcemaps = require('gulp-sourcemaps')
var src = 'src/**/*.js'

gulp.task('default', ['watch'])
gulp.task('dev', ['lint:soft', 'transpile'])
gulp.task('dist', ['lint', 'transpile'])

gulp.task('transpile', function () {
  return gulp.src(src)
    .pipe(sourcemaps.init())
      .pipe(babel({ blacklist: ['regenerator'] }))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('lib'))
})

gulp.task('lint:soft', lint)
gulp.task('lint', function () {
  return lint({ breakOnError: true })
})

function lint (opts) {
  return gulp.src([__filename].concat(src))
    .pipe(standard())
    .pipe(standard.reporter('default', opts || {}))
}

gulp.task('watch', ['dev'], function () {
  gulp.watch(src, ['dev'])
})
