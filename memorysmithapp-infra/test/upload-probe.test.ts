/**
 * The probe of the upload host (#467): `GET /probe` answered at the edge with
 * the fixed body an agent's code compares, and the address handed to the agent.
 */

import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { UPLOAD_PROBE } from '@memorysmithapp/contracts';
import { appFor, stacksOf } from './stacks.js';

interface Behaviour {
  PathPattern?: string;
  AllowedMethods: string[];
  FunctionAssociations?: { EventType: string; FunctionARN: unknown }[];
}

describe('the probe of the upload host', () => {
  const stacks = stacksOf(appFor('staging'));
  const api = Template.fromStack(stacks.api);
  const agent = Template.fromStack(stacks.agent);

  const uploads = Object.values(api.findResources('AWS::CloudFront::Distribution'))
    .map(
      (resource) =>
        (
          resource.Properties as {
            DistributionConfig: {
              Aliases?: string[];
              DefaultCacheBehavior: Behaviour;
              CacheBehaviors?: Behaviour[];
            };
          }
        ).DistributionConfig,
    )
    .find((config) => config.Aliases?.includes('uploads.stg.memorysmith.app'));

  it('is a behaviour of its own, answered by a function at the viewer request', () => {
    const probe = uploads?.CacheBehaviors?.find((b) => b.PathPattern === UPLOAD_PROBE.path);
    expect(probe?.AllowedMethods).toEqual(['GET', 'HEAD']);
    expect(probe?.FunctionAssociations?.map((f) => f.EventType)).toEqual(['viewer-request']);
    // The parts still go to the bucket as before, through the default behaviour.
    expect(uploads?.DefaultCacheBehavior.FunctionAssociations).toBeUndefined();
    expect(uploads?.DefaultCacheBehavior.AllowedMethods).toContain('PUT');
  });

  it('answers 200 with the fixed body, never reaching the origin', () => {
    const functions = Object.values(api.findResources('AWS::CloudFront::Function')).map(
      (resource) =>
        resource.Properties as { FunctionCode: string; FunctionConfig: { Runtime: string } },
    );
    const probe = functions.find((f) => f.FunctionCode.includes(UPLOAD_PROBE.body));
    expect(probe?.FunctionConfig.Runtime).toBe('cloudfront-js-2.0');
    expect(probe?.FunctionCode).toContain('statusCode: 200');
    expect(probe?.FunctionCode).not.toContain('return event.request');
  });

  it('is named to the agent through the origin of the upload host', () => {
    const functions = Object.values(agent.findResources('AWS::Lambda::Function')).map(
      (resource) =>
        (resource.Properties as { Environment?: { Variables?: Record<string, unknown> } })
          .Environment?.Variables ?? {},
    );
    expect(
      functions.some((v) => v['UPLOADS_ORIGIN'] === 'https://uploads.stg.memorysmith.app'),
    ).toBe(true);
  });
});
